var gulp = require('gulp');
var gutil = require('gulp-util');
var uglify = require('gulp-uglify');
var watch = require('gulp-watch');
var concat = require('gulp-concat');
var notify = require('gulp-notify');
var browserify = require('gulp-browserify');

gulp.task('default', function () {
    // to be done...
});

gulp.task('browserify', function () {
  gulp.src('./codegradxlib.js')
    .pipe(browserify({
           debug : !gulp.env.production
    }))
    .pipe(gulp.dest('final'));
});
