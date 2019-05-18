const gulp = require('gulp');

const browserSync = require('browser-sync').create();
const sass = require('gulp-sass');
const autoprefixer = require('gulp-autoprefixer');

const clean = require('gulp-rm');
// Use gulp-terser instead of gulp-uglifyes
const uglify = require('gulp-terser');
const minify = require('gulp-clean-css');


// DEV TASKS
gulp.task('serve',()=>{
  // launch browser-sync server and serve files from src
  browserSync.init({ server: './src' });
  // reload page if html and js file changed
  gulp.watch('./src/**/*.{html,js}').on('change', browserSync.reload);
  // run 'sass' task if scss files changed
  gulp.watch('./src/sass/**/*.scss', gulp.series('sass'));
});


gulp.task('sass',()=>{
  // get all scss files in sass directory
  return gulp.src('./src/sass/**/*.scss')
    // compile SASS to CSS and log errors to terminal
    .pipe(sass().on('error', sass.logError))
    // add vendor prefixes for last 4 broswer versions
    .pipe(autoprefixer({ browsers: ['last 4 versions'] }))
    // save compiled file to css directory
    .pipe(gulp.dest('./src/css'))
    // make browser-sync inject changes into page
    .pipe(browserSync.stream())
});



// BUILD SUBTASKS
gulp.task('clean',()=>{
  // get all files in dist dir
  return gulp.src('./dist/**/*')
  // delete them
  .pipe(clean());
});


gulp.task('copy',()=>{
  // get all html files and images in img/ directory
  return gulp.src('./src/{**/*.html,img/*}')
    // copy them to dist/
    .pipe(gulp.dest('./dist/'))
});


gulp.task('js',()=>{
  // get all js files
  return gulp.src('./src/js/**/*.js')
    // uglify them
    .pipe(uglify())
    // copy them to dist/
    .pipe(gulp.dest('./dist/js/'))
});


gulp.task('css', gulp.series('sass',()=>{
  // get all css files
  return gulp.src('./src/css/**/*.css')
    // minify them
    .pipe(minify())
    // copy them to dist/
    .pipe(gulp.dest('./dist/css/'))
}));



// BUILD TASKS
gulp.task('build', gulp.series(
    'clean',
    gulp.parallel('copy','js','css')
));

gulp.task('serveBuild', gulp.series('build',()=>{
  // create second browsersync instance
  browserSync.init({
	// make it serve files from `dist/`...
    server: './dist',
    // on port 3030
    port: 3030
  });
}));


// DEPLOY TASKS
const fs = require('fs');
const webhost = JSON.parse(fs.readFileSync('./webhost-config.json'));
const webhostDir = '/public_html/website/';

// SCP DELPOY
const rsync = require('gulp-rsync');

gulp.task('deploy', gulp.series('build',()=>{
  // if '--all' included in command updateOnly is false else it's true
  const updateOnly = process.argv.indexOf('--all') === -1;
  return gulp.src('./dist/')
    // upload to server using details in webhost-config.json
    .pipe(rsync({
      hostname: webhost.address,
      username: webhost.ssh.username,
      destination: `~${webhostDir}`,
      port: webhost.ssh.port,
      // remove locally deleted files from server 
      clean: true,
      // compress the contents to be uploaded
      compress: true,
      // upload all directories and files in dist/
      recursive: true,
      // only upload the contents of dist/ and not dist/ itself
      root: 'dist',
      // always output to terminal
      silent: false,
      // update changed files only
      update: updateOnly
    }))
}));


// FTP DELPOY
const prompt = require('gulp-prompt');
const ftp = require('vinyl-ftp');

gulp.task('ftp-deploy', gulp.series('build',()=>{
  // if '--all' included in command updateOnly is false else it's true
  const updateOnly = process.argv.indexOf('--all') === -1;
  return gulp.src('./gulpfile.js')
    // prompt user for password
    .pipe(prompt.prompt({
      type: 'password',
      name: 'pass',
      message: 'Enter FTP password:'
    },(res)=>{
      // create conn config object from webhost-config.json and entered password
      let conn = ftp.create({
        host: webhost.address,
        user: webhost.ftp.username,
        password: res.pass,
        port: webhost.ftp.port,
        parallel: 10
      });
      // select contents of `dist/` for upload  
      let stream = gulp.src('./dist/**/*', { base:'./dist', buffer:false });
      if (!updateOnly) {
        // only upload updated files
        stream = stream.pipe(conn.newer(webhostDir));
      }
      stream = stream.pipe(conn.dest(webhostDir));
    }));
}));



// DEFAULT TASK
gulp.task('default', gulp.series('sass','serve'));