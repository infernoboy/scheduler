/*
* @Last modified in Sublime on Jul 08, 2018 07:32:43 PM
*/

'use strict';

const cluster = require('cluster');
const fs = require('fs-extra');
const Workers = require('../../../clusters');
const uuidv4 = require('uuid/v4');
const {Utilities, Log} = require('../../../shared/utilities');
const {SchedulerConfig} = require('../../../shared/user.config');
const Email = require('../../../shared/email');

const Scheduler = {
	OFFSET: 1000 * 60 * 5,
	EVERY: 1000 * 60,

	_dataFilePath: __dirname + '/../data/schedules.json',
	_timeout: null,

	_messageHandler(message) {
		if (!cluster.isMaster && message.from === cluster.worker.id)
			return;

		switch (message.type) {
			case 'addedScheduleData':
			case 'updateScheduleData':
				if (Scheduler.data.modified && Scheduler.data.modified < message.data.modified)
					Scheduler.data = message.data;

				if (cluster.isMaster)
					Scheduler._run();

				break;
		}
	},

	_saveData() {
		fs.writeJson(Scheduler._dataFilePath, Scheduler.data, (err) => {
			if (err)
				Log('Scheduler._saveData error:', err);
			else
				(cluster.isMaster ? Workers : process).send({
					from: cluster.isMaster ? -1 : cluster.worker.id,
					type: 'updateScheduleData',
					data: Scheduler.data
				});
		});
	},

	_run() {
		clearTimeout(Scheduler._timeout);

		Scheduler._timeout = null;

		const now = Date.now();
		const newScheduledData = {
			modified: now,
			entries: {}
		};

		for (let [id, scheduledItem] of Object.entries(Scheduler.data.entries))
			if (now < scheduledItem.when)
				newScheduledData.entries[id] = scheduledItem;
			else if (now - scheduledItem.when > Scheduler.OFFSET)
				Log('Missed scheduled item, skipping:', scheduledItem);
			else
				Scheduler._execute(scheduledItem);

		Scheduler.data = newScheduledData;

		if (Scheduler.hasScheduledItems)
			Scheduler._timeout = setTimeout(Scheduler._run, Scheduler.EVERY);

		Scheduler._saveData();
	},

	_execute(data) {
		switch (data.type) {
			case 'message':
				Utilities.writeToLog('Scheduler: sending scheduled message:', data.meta);

				Email.send(SchedulerConfig.to[data.meta.to], 'Scheduled Message', data.meta.message, [], data.meta.silent ? SchedulerConfig.from.silent : SchedulerConfig.from.normal);

				break;
		}
	},

	hasScheduledItems() {
		return Object.keys(Scheduler.data).length > 0;
	},

	create(info) {
		switch (info.type) {
			case 'futureMessage':
				return Scheduler.createFutureMessage(info);
			default:
				return Promise.reject('invalid type');
		}
	},

	createFutureMessage(info) {
		if (typeof info.message !== 'string' || !info.message.length)
			return Promise.reject('invalid message');

		if (!SchedulerConfig.to.hasOwnProperty(info.to))
			return Promise.reject('invalid to');

		info.date = new Date(info.date);

		if (isNaN(info.date.getTime()))
			return Promise.reject('invalid date');

		const id = uuidv4();

		Scheduler.data.modified = Date.now();

		Scheduler.data.entries[id] =  {
			type: 'message',
			when: info.date.getTime(),
			meta: {
				to: info.to,
				message: info.message,
				silent: info.hasOwnProperty('silent')
			}
		};

		Scheduler._saveData();

		Utilities.writeToLog('Scheduler: created new future message.');

		return Promise.resolve(Scheduler.data.entries[id]);
	}
};

try {
	Scheduler.data = fs.readJsonSync(Scheduler._dataFilePath);

	Scheduler.data.modified._;
	Scheduler.data.entries._;
} catch (error) {
	Log('Missing valid schedules file:', error);
	
	Scheduler.data = {
		modified: Date.now(),
		entries: {}
	};

	Scheduler._saveData();
}

if (cluster.isMaster) {
	Scheduler._run();

	Workers.addMessageHandler(Scheduler._messageHandler);
}

process.on('message', Scheduler._messageHandler);

module.exports = Scheduler;
