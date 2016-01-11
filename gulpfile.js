var gulp = require('gulp'),
    args = require('yargs').argv,
    config = require('./gulp.config')(),
    del = require('del'),
    browserSync = require('browser-sync'),
    $ = require('gulp-load-plugins')({
        lazy: true
    });
var port = process.env.PORT || config.defaultPort;

gulp.task('help', $.taskListing);

gulp.task('default', ['help']);

gulp.task('vet', function() {
    log('Analyzing source with JSHint and JSCS');

    return gulp
        .src(config.alljs)
        .pipe($.if(args.verbose, $.print()))
        .pipe($.jshint())
        .pipe($.jshint.reporter('jshint-stylish', {
            verbose: true
        }))
        .pipe($.jshint.reporter('fail'))
        .pipe($.jscs());
});

/**
 * Compile less to css
 */
gulp.task('styles', ['clean-styles'], function() {

    log('Compiling Less --> CSS');
    return gulp
        .src(config.less)
        .pipe($.plumber()) // exit gracefully if something fails after this
        .pipe($.less())
        //.on('error', errorLogger) // more verbose and dupe output. requires emit.
        .pipe($.autoprefixer({
            browsers: ['last 2 version', '> 5%']
        }))
        .pipe(gulp.dest(config.temp));
});

gulp.task('fonts', ['clean-fonts'], function() {
    log('copying fonts');
    return gulp
        .src(config.fonts)
        .pipe(gulp.dest(config.build + 'fonts'));
});

gulp.task('images', ['clean-images'], function() {
    log('copying and compressing the images');
    return gulp
        .src(config.images)
        .pipe($.imagemin({
            optimizationLevel: 4
        }))
        .pipe(gulp.dest(config.build + 'images'));
});

gulp.task('clean', function() {
    var delconfig = [].concat(config.build, config.temp);
    log('Cleaning: ' + $.util.colors.blue(delconfig));
    clean(delconfig);
});

gulp.task('clean-styles', function() {
    var files = [].concat(
        config.temp + '**/*.css',
        config.build + 'styles/**/*.css'
    );
    clean(files);
});

gulp.task('clean-fonts', function() {
    var files = config.build + 'fonts/**/*.*';
    clean(files);
});

gulp.task('clean-images', function() {
    var files = config.build + 'images/**/*.*';
    clean(files);
});

gulp.task('clean-code', function() {
    var files = [].concat(
        config.temp + '**/*.js',
        config.build + 'js/**/*.js',
        config.build + '**/*.html'
    );
    clean(files);
});

gulp.task('less-watcher', function() {
    gulp.watch([config.less], ['styles']);
});


//html templatecache
gulp.task('templatecache', function() {
    log('creating angularjs $templateCache');
    return gulp
        .src(config.htmltemplates)
        .pipe($.minifyHtml({
            empty: true
        }))
        .pipe($.angularTemplatecache(
            config.templateCache.file,
            config.templateCache.options))
        .pipe(gulp.dest(config.temp));
});

gulp.task('wiredep', function() {
    log('Wiring the bower dependencies into the html');
    var wiredep = require('wiredep').stream;
    var options = config.getWiredepDefaultOptions();
    // Only include stubs if flag is enabled
    //var js = args.stubs ? [].concat(config.js, config.stubsjs) : config.js;
    return gulp
        .src(config.index)
        .pipe(wiredep(options))
        .pipe($.inject(gulp.src(config.js)))
        .pipe(gulp.dest(config.client));
});


gulp.task('inject', ['wiredep', 'styles', 'templatecache'], function() {
    log('Wire up css into the html, after files are ready');

    return gulp
        .src(config.index)
        .pipe($.inject(gulp.src(config.css)))
        .pipe(gulp.dest(config.client));
});

gulp.task('optimize', ['inject'], function() {
    log('Optimizing the js, css, and html');
    // // Filters are named for the gulp-useref path
    var cssFilter = $.filter('**/*.css', {
        restore: true
    });
    var jsAppFilter = $.filter('**/' + config.optimized.app, {
        restore: true
    });
    var jslibFilter = $.filter('**/' + config.optimized.lib, {
        restore: true
    });
    var notIndexFilter = $.filter('!**/' + config.index, {
        restore: true
    });


    var templateCache = config.temp + config.templateCache.file;

    return gulp
        .src(config.index)
        .pipe($.plumber())
        .pipe($.useref({
            searchPath: './'
        }))
        .pipe($.inject(gulp.src(templateCache, {
            read: false
        }), {
            starttag: '<!-- inject:templates:js -->'
        }))

        .pipe(cssFilter)
        .pipe($.csso())
        .pipe(cssFilter.restore)
        .pipe(jslibFilter)
        .pipe($.uglify())
        .pipe(jslibFilter.restore)
        .pipe(jsAppFilter)
        .pipe($.ngAnnotate({
            add: true
        }))
        .pipe($.uglify())
        .pipe(jsAppFilter.restore)
        //.pipe(notIndexFilter)
        .pipe($.rev())
        //.pipe(notIndexFilter.restore)
        .pipe($.revReplace())
        .pipe(gulp.dest(config.build));
});

gulp.task('serve-build', ['optimize'], function() {
    serve(false /* isDev */ );
});

gulp.task('serve-dev', ['inject'], function() {
    serve(true /* isDev */ );
});

gulp.task('test', ['vet', 'templatecache'], function(done) {
    startTests(true /*singleRun*/ , done);
});

///////////

function serve(isDev) {
    var nodeOptions = {
        script: config.nodeServer,
        delayTime: 1,
        env: {
            'PORT': port,
            'NODE_ENV': isDev ? 'dev' : 'build'
        },
        watch: [config.server]
    };
    return $.nodemon(nodeOptions)
        .on('restart', function(ev) {
            log('**** nodemon restarted');
            log('files changed on restart:\n' + ev);
            setTimeout(function() {
                browserSync.notify('reloading now ...');
                browserSync.reload({
                    stream: false
                });
            }, config.browserReloadDelay);
        })
        .on('start', function() {
            log('**** nodemon started');
            startBrowserSync(isDev);
        })
        .on('crash', function() {
            log('**** nodemon crashed: script crashed for some reason');
        })
        .on('exit', function() {
            log('**** nodemon exited cleanly');
        });
}

function errorLogger(error) {
    log('*** Start of Error ***');
    log(error);
    log('*** End of Error ***');
    this.emit('end');
}

function clean(path) {
    log('Cleaning: ' + $.util.colors.blue(path));
    return del(path);
}

function log(msg) {
    if (typeof(msg) === 'object') {
        for (var item in msg) {
            if (msg.hasOwnProperty(item)) {
                $.util.log($.util.colors.blue(msg[item]));
            }
        }
    } else {
        $.util.log($.util.colors.blue(msg));
    }
}

function changeEvent(event) {
    var srcPattern = new RegExp('/.*(?=/' + config.source + ')/');
    log('File ' + event.path.replace(srcPattern, '') + ' ' + event.type);
}

function startBrowserSync(isDev) {
    if (args.nosync || browserSync.active) {
        return;
    }
    log('start browser-sync on port' + port);

    if (isDev) {
        gulp.watch([config.less], ['styles'])
            .on('change', function(event) {
                changeEvent(event);
            });
    } else {
        gulp.watch([config.less, config.js, config.html], ['optimize'])
            .on('change', function(event) {
                changeEvent(event);
            });
    }

    var options = {
        proxy: 'localhost:' + port,
        port: 4000,
        files: [
            config.client + '**/*.*',
            '!' + config.less,
            config.temp + '**/*.css'
        ],
        ghostMode: {
            clicks: true,
            location: false,
            forms: true,
            scroll: true
        },
        injectChanges: true,
        logFileChanges: true,
        logLevel: 'debug',
        logPrefix: 'gulp-master',
        notify: true,
        reloadDelay: 0 //1000
    };

    browserSync(options);
}
