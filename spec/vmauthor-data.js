// Initialise the global state in order to use the servers of
// the VMauthor-CodeGradX virtual machine.

module.exports.initialize = function (state) {
  state.servers = {
    names: ['a', 'e', 'x', 's'],
    domain: 'vmauthor.paracamplus.com',
    a: {
      //next: 1,
      suffix: '/alive',
      0: {
        host: 'vmauthor.paracamplus.com/a',
        enabled: false
      }
    },
    e: {
      //next: 1,
      suffix: '/alive',
      0: {
        host: 'vmauthor.paracamplus.com/e',
        enabled: false
      }
    },
    x: {
      //next: 1,
      suffix: '/dbalive',
      0: {
        host: 'vmauthor.paracamplus.com/x',
        enabled: false
      }
    },
    s: {
      //next: 1,
      suffix: '/index.html',
      0: {
        host: 'vmauthor.paracamplus.com/s',
        enabled: false
      }
    }
  };
  return state;
};
