// Modify a state in order to use the servers of vmauthor.

module.exports.initialize = function (state) {
  state.servers = {
    names: ['a', 'e', 'x', 's'],
    domain: 'vmauthor.vld7net.fr',
    a: {
      next: 1,
      suffix: '/alive',
      0: {
        host: 'avmauthor.vld7net.fr',
        enabled: false
      }
    },
    e: {
      next: 1,
      suffix: '/alive',
      0: {
        host: 'evmauthor.vld7net.fr',
        enabled: false
      }
    },
    x: {
      next: 1,
      suffix: '/dbalive',
      0: {
        host: 'xvmauthor.vld7net.fr',
        enabled: false
      }
    },
    s: {
      next: 1,
      suffix: '/',
      0: {
        host: 'svmauthor.vld7net.fr',
        enabled: false
      }
    }
  };
  return state;
};
