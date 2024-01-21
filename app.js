var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var menadzerRouter = require('./routes/menadzer');
var radnikRouter = require('./routes/radnik');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//OVDJEE
app.use((req, res, next) => {

  if (req.path === '/login' || req.path === '/') {
    return next()
  }
  const opknCookie = req.cookies?.opkn
  if(opknCookie) {
    const userData = opknCookie
    const email = userData.email
    const lozinka = userData.lozinka

    return next()
  }

  else {
    return res.send({status:403, message: 'Not authorized'})
  }
})
//


app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/menadzer', menadzerRouter);
app.use('/radnik', radnikRouter);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  //next(createError(404));
  res.redirect('/404');
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

//app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(express.static(path.join(__dirname, 'images')));

module.exports = app;
