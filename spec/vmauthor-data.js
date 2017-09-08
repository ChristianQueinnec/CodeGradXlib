// Initialise the global state in order to use the servers of
// the VMauthor-CodeGradX virtual machine.

var vmauthor = 'vmauthor.codegradx.org';
//var vmauthor = '192.168.122.205';
//var vmauthor = 'vmauthor';

module.exports.initialize = function (state) {
  state.servers = {
    names: ['a', 'e', 'x', 's'],
    domain: vmauthor,
    a: {
      //next: 1,
      suffix: '/alive',
      0: {
        host: vmauthor + '/a',
        enabled: false
      }
    },
    e: {
      //next: 1,
      suffix: '/alive',
      0: {
        host: vmauthor + '/e',
        enabled: false
      }
    },
    x: {
      //next: 1,
      suffix: '/dbalive',
      protocol: 'http',
      0: {
        host: vmauthor + '/x',
        enabled: false
      }
    },
    s: {
      //next: 1,
      suffix: '/index.html',
      0: {
        host: vmauthor + '/s',
        enabled: false
      }
    }
  };
  return state;
};
