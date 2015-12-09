# CodeGradXlib

CodeGradX is a grading infrastructure
- where students submit programs to solve exercises and these programs
  are mechanically graded,
- where authors deploy exercises and propose them to students,
- where teachers may follow the progress of a cohort of students.

The CodeGradX infrastructure is operated via REST protocols. To ease
its use, CodeGradXlib is a Javascript Library that provides a
programmatic API to operate the CodeGradX infrastructure.

CodeGradXlib is low level library, using promises everywhere. A higher
level library is provided by `CodeGradXagent`: a command line script,
running on top of Node.js. This low lever library may be used by other
web applications.

More information (partially in French) on the [CodeGradX
](http://paracamplus.com/spip/spip.php?rubrique2) infrastructure.

## Installation

```javascript
npm install codegradxlib
```

If you are CLI-inclined then

```javascript
npm install CodeGradXagent
```

## Terminology

In this section, important words are capitalized and correspond to
classes in the CodeGradXlib code.

You must first initialize the CodeGradXlib library by creating a
State. This State concentrates some global resources for the library and
mentions the various servers of the CodeGradX
infrastructure and how to check their availability. It is probably
worthless to change the default setting.

Then you must authenticate with respect to the CodeGradX
infrastructure with a login and a password. To get this login and
password, you must [register](http://codegradx.org/register).
Authentication returns a User object.

The User object lists the Campaigns the User may access. A Campaign is
a Javascript object offering a set of Exercises (an ExercisesSet),
to a group of students during a certain period of time.

To an Exercise is associated a stem (an XML document ruled by a
[RelaxNG grammar](http://paracamplus.com/CodeGradX/Resources/fw4exRngDoc.pdf))
and, somewhere hidden in the constellation of CodeGradX servers, some grading
scripts. A User may send a string or a file (a tar gzipped file if
more than one file is expected) against an Exercise. Other metadata
are associated to the Exercise defining the authors, the expectations (one or
multiple files, how they should be named, templates for them,
approximate size, etc.): all information useful to set appropriately
the user interface.

When an answer is sent towards an Exercise, a Job is returned from
which a grading report may be obtained. The grading report is stored
as a property of the Job. The grading report is an XML document ruled
by a [RelaxNG
grammar](http://paracamplus.com/CodeGradX/Resources/fw4exRngDoc.pdf)
so this report is skinnable.

The `tonicExample.js` file is an example of that process.

Users that are also potential authors of Exercises may submit a new exercise
that is, a tar-gzipped file with a precise structure., An Exercise is then
returned from which an author's report may be obtained telling whether the
Exercise is deployed or not.

Users may gather students' answers in a big tar gzipped file and submit
all these answers against one Exercise in a Batch. A Batch object is
returned from which Jobs can be individually obtained.

Many details can be found (in English) in the [documentation](http://paracamplus.com/CodeGradX/Resources/overview.pdf)
that contains the [RelaxNG grammar](http://paracamplus.com/CodeGradX/Resources/fw4exRngDoc.pdf).
