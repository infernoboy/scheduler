/*
* @Last modified in Sublime on Jul 08, 2018 06:23:38 PM
*/
const Scheduler = require('../../controllers/schedule');

module.exports = {
	createScheduledItem(req, res) {
		Scheduler.create(req.body).then((result) => {
			res.json(result);
		}, (err) => {
			res.json({
				error: err
			});
		});
	}
};
