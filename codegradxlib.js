
if ( ! CodeGradX ) {
    var CodeGradX = function () {};
}

CodeGradX.classes = {};

// **************** Global state

CodeGradX.classes.State = function () {
    // State of servers:
    this.servers = {};
    this.servers.a = { next: 2,
                       0: { host: 'a0.paracamplus.com',
                            enabled: true },
                       1: { host: 'a1.paracamplus.com',
                            enabled: true } };
    this.servers.e = { next: 2,
                       0: { host: 'e0.paracamplus.com',
                            enabled: true },
                       1: { host: 'e1.paracamplus.com',
                            enabled: true } };
    this.servers.x = { next: 2,
                       0: { host: 'x0.paracamplus.com',
                            enabled: true },
                       1: { host: 'x1.paracamplus.com',
                            enabled: true } };
    this.servers.s = { next: 2,
                       0: { host: 's0.paracamplus.com',
                            enabled: true },
                       1: { host: 's1.paracamplus.com',
                            enabled: true } };
    // Caches for Exercises, Jobs, Batches
    this.caches = {};
    // Current values
    this.currentUser = null;
};

CodeGradX.classes.State.prototype.checkServers = function (cb) {
    // check existing servers, remove non working servers
};

CodeGradX.classes.State.prototype.discoverServers = function (cb) {
    // try next possible one
};

// **************** User

CodeGradX.classes.User = function (login, password) {
  this.login = login;
  this.password = password;
};

CodeGradX.classes.User.prototype.connect = function (cb) {
  // check cookie then send credentials and get additional information
  // set current user
};

CodeGradX.classes.User.prototype.modify = function (fields, cb) {
  // send modifications then update local User
};

CodeGradX.classes.User.prototype.campaigns = function (now, cb) {
  // get active campaigns if now otherwise all campaigns
};

CodeGradX.classes.User.prototype.campaign = function (name, cb) {
  // get information on a Campaign
};

// **************** Campaign

CodeGradX.classes.Campaign = function (name) {
  this.name = name;
};

CodeGradX.classes.Campaign.prototype.skills = function (cb) {
  // get skills of the students of this campaign
};

CodeGradX.classes.Campaign.prototype.jobs = function (cb) {
  // get the jobs of the user within the campaign
};

CodeGradX.classes.Campaign.prototype.exercises = function (cb) {
  // get the exercises of this campaign
};


// **************** Exercise

CodeGradX.classes.Exercise = function (uuid) {
  this.uuid = uuid;
};

CodeGradX.classes.Exercise.prototype.description = function (cb) {
  // get metadata
};

CodeGradX.classes.Exercise.prototype.stem = function (cb) {
  // get stem
};

CodeGradX.classes.Exercise.prototype.newStringAnswer = function (cb) {
  // create an answer
};

CodeGradX.classes.Exercise.prototype.newFileAnswer = function (cb) {
  // create an answer
};


// **************** Answer

CodeGradX.classes.Answer = function (exercise) {
  this.exercise = exercise;
};

CodeGradX.classes.Answer.prototype.submit = function (cb) {
  // submit an answer (string or file) towards an exercise, returns a Job
};

// subclasses

CodeGradX.classes.FileAnswer = function (exercise) {
  this.exercise = exercise;
};
CodeGradX.classes.FileAnswer.prototype =
   Object.create(CodeGradX.classes.Answer.prototype);
CodeGradX.classes.FileAnswer.prototype.constructor =
   CodeGradX.classes.FileAnswer;

CodeGradX.classes.StringAnswer = function (exercise) {
  this.exercise = exercise;
};
CodeGradX.classes.StringAnswer.prototype =
   Object.create(CodeGradX.classes.Answer.prototype);
CodeGradX.classes.StringAnswer.prototype.constructor =
   CodeGradX.classes.StringAnswer;

// **************** Job

CodeGradX.classes.Job = function (uuid) {
  this.uuid = uuid;
};

CodeGradX.classes.Job.prototype.report = function (cb) {
  // get the grading report
};




// end of codegradxlib.js
