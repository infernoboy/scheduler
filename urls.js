/*
* @Last modified in Sublime on Jul 08, 2018 06:21:55 PM
*/
/*
* @Last modified in Sublime on Jul 08, 2016 06:18:06 PM
*/
const router = require('express').Router();
const morgan = require('morgan');
const routes = require('./lib/routes/web');
const {logFormat} = require('../app');
const {Utilities} = require('../shared/utilities');

const logFileName = process.env.NODE_ENV === 'development' ? 'dev' : 'production';

morgan.token('tzdate', () => Utilities.date('d/t/Y:H:M:s z'));

router.use(morgan(logFormat, {
	stream: require('file-stream-rotator').getStream({
		date_format: 'YYYY-MM-DD',
		filename: `${__dirname}/logs/${logFileName}-%DATE%.log`,
		frequency: '7d',
		verbose: false
	})
}));

router.use((req, res, next) => {
	req.basePath = '/scheduler/';

	next();
});

router.post('/create', routes.createScheduledItem);

module.exports = router;
