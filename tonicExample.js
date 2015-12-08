// This is an example of use of the codegradxlib library.

var CodeGradX = require('./codegradxlib.js');

// First initialize the library with a State. By default, it uses the
// real constellation of servers running the CodeGradX infrastructure:
(new CodeGradX.State())
// now authenticate with your own login then password:
.getAuthenticatedUser('nobody:0', 'xyzzy')
// select the `free` campaign that lists a number of exercises in
// various programming languages. The `free` campaign is freely
// available for everybody.
.then(function (user) {
    console.log("Hello " + user.email);
    user.getCampaign('free')
    .then(function (campaign) {
        console.log("Welcome to the " + campaign.name + " set of exercises");
        // Select an exercise in the C programming language:
        campaign.getExercise('com.paracamplus.li205.function.1')
        .then(function (exercise) {
            console.log("This is the " + exercise.name + " exercise");
            // The stem of that exercise is to write a function named `min`
            // taking two integers and returning the smallest one. We send
            // this string as a possible answer:
            exercise.sendStringAnswer("\
int \n\
min (int x, int y) \n\
{ \n\
  return (x<y)?x:y; \n\
}\n")
                .then(function (job) {
                    console.log("Your answer is currently being graded...");
                    // We now have to wait for the grading report:
                    job.getReport()
                        .then(function (job) {
                            // We may now see our grade:
                            console.log('Your answer is worth ' + job.mark + 
                                        '/' + job.totalMark);
                            // We may now display the whole report.
                            // This is a skinnable XML:
                            //console.log(job.XMLreport);
                        });
                });
        });
    });
});
