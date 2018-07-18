# CodeGradXlib

CodeGradX is a grading infrastructure
- where students submit programs to solve exercises and these programs
  are mechanically graded,
- where authors deploy exercises and propose them to students,
- where teachers may follow the progress of a cohort of students.

The CodeGradX infrastructure (or constellation since the
infrastructure is made of a number of independent servers) is operated
via REST protocols. To ease its use, CodeGradXlib is a Javascript
Library that provides a programmatic API to operate the CodeGradX
infrastructure.

CodeGradXlib is a low level library, using promises everywhere. A
higher level library is provided by `CodeGradXagent`: a command line
script, running on top of Node.js (another higher level library is the
`CodeGradXvmauthor` command line script that operates a local virtual
machine that runs locally the whole CodeGradX infrastructure). This
low lever library may be used by other web applications.

More information (partially in French) on the [CodeGradX
](https://codegradx.org) infrastructure.

## Installation

```javascript
npm install codegradxlib
```

If you are CLI-inclined then

```javascript
npm install codegradxagent
```

If you use the virtual machine for authors then

```javascript
npm install codegradxvmauthor
```

## Terminology

In this section, important words are capitalized and correspond to
classes in the CodeGradXlib code.

Here is an example of use of the CodeGradXlib library.

```javascript
// Example of use:
var CodeGradX = require('codegradxlib');

new CodeGradX.State();

CodeGradX.getCurrentState().
  // ask for user's login and password:
  getAuthenticatedUser(login, password).
    then(function (user) {
       // let the user choose one campaign among user.getCampaigns()
       // let us say that we choose campaign 'free':
       user.getCampaign('free').
         then(function (campaign) {
           // let the user choose one exercise among campaign.getExercisesSet()
           campaign.getExercise('some.exercise.name').
             then(function (exercise) {
               exercise.getDescription().
                 then(function (description) {
                   // display stem of exercise and get user's answer:
                   exercise.sendFileAnswer("some.filename").
                     then(function (job) {
                       // wait for the marking report:
                       job.getReport().
                         then(function (job) {
                           // display job.report
```


You must first initialize the CodeGradXlib library by creating a
State. This State concentrates some global resources for the library and
mentions the various servers of the CodeGradX
infrastructure and how to check their availability. It is probably
worthless to change the default setting.

Then you must authenticate with respect to the CodeGradX
infrastructure with a login and a password. To get this login and
password, you must [register](https://p.codegradx.org/).
The authentication process returns a User object.

The User object lists the Campaigns the User may access. A Campaign is
a Javascript object offering a set of Exercises (an ExercisesSet), to
a group of students during a certain period of time. You may then
choose one campaign among the available campaigns. Once a campaign is
choosen, the tree of associated exercises can be obtained from that
campaign and from that tree, one may choose a particular exercise.

To an Exercise is associated a description containing a stem (an XML
document ruled by a [RelaxNG
grammar](https://codegradx.org/CodeGradX/Resources/fw4exRngDoc.pdf))
and, somewhere hidden in the constellation of CodeGradX servers, some
grading scripts. A User may send a string or a file (a tar gzipped
file if more than one file is expected) against an Exercise. Other
metadata are associated to the Exercise defining the authors, the
expectations (one or multiple files, how they should be named,
templates for them, approximate size, etc.): all information useful to
set appropriately the user interface.

When an answer is sent towards an Exercise, a Job is returned from
which a grading report may be obtained. The grading report is stored
as a property of the Job. The grading report is an XML document ruled
by a [RelaxNG
grammar](https://codegradx.org/CodeGradX/Resources/fw4exRngDoc.pdf)
so this report is skinnable. This XML is a side-set of HTML, a naive
converter (named `CodeGradX.xml2html`) is included in the library.

Users that are also potential authors of Exercises may submit a new exercise
that is, a tar-gzipped file with a precise structure., An Exercise is then
returned from which an author's report may be obtained telling whether the
Exercise was deployed or not. Grading reports must be valid XML document
with respect to the grammar mentioned above. If the new exercise produces
invalid document or if the grading scripts are erroneous a problem report
can also be obtained from the job: see the `getProblemReport` method.

Users may gather students' answers in a big tar gzipped file and submit
all these answers against one Exercise in a Batch. A Batch object is
returned from which Jobs can be individually obtained.

Many details can be found (in English) in the [documentation
](https://codegradx.org/CodeGradX/Resources/overview.pdf)
that contains the [RelaxNG grammar
](https://codegradx.org/CodeGradX/Resources/fw4exRngDoc.pdf).

## Documentation

Chapter 1 of the [big
documentation](https://codegradx.org/CodeGradX/Resources/overview.pdf)
is useful to have an overview of the CodeGradX constellation.

State, User, Exercise, Job etc. are classes defined in the source
code, they are equiped with multiple methods. 

The grammar of XML documents provides information on the various
fields of objects of classes State, User, Exercise, Job etc. It also
describes the various exchanges between the user's browser and the
CodeGradX constellation.
