module.exports = function () {
	var client = './src/client/';
	var server = './src/server/';
	var clientApp = client + 'app/';
	var report = './report/';
	var root = './';
	var specRunnerFile = 'specs.html';
	var temp = './.tmp/';
	var wiredep = require('wiredep');
	var bowerFiles = wiredep({
		devDependencies: true
	})['js'];
	var bower = {
		json: require('./bower.json'),
		directory: './bower_components/',
		ignorePath: '../..'
	};
	var nodeModules = 'node_modules';

	var config = {
		/**
		 * File paths
		 */
		// all javascript that we want to vet
		alljs: [
            './src/**/*.js',
            './*.js'
        ],
		build: './build/',
		client: client,
		css: temp + 'styles.css',
		fonts: bower.directory + 'font-awesome/fonts/**/*.*',
		html: client + '**/*.html',
		htmltemplates: clientApp + '**/*.html',
		images: client + 'images/**/*.*',
		index: client + 'index.html',
		// app js, with no specs
		js: [
            clientApp + '**/*.module.js',
            clientApp + '**/*.js',
            '!' + clientApp + '**/*.spec.js'
        ]
	};

	return config;
};