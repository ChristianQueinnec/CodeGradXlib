// Tests with 'rest' library

var CodeGradX = require('../codegradxlib.js');
var when = require('when');
var rest = require('rest');
var mime = require('rest/interceptor/mime');

describe("rest", function () {

    function make_faildone (done) {
        return function faildone (reason) {
            console.log(reason);
            fail(reason);
            done();
        };
    }

    it("incorrect host", function (done) {
        var faildone = make_faildone(done);
        rest('http://absent.o/12345')
            .then(function (response) {
                console.log('response', response);
                faildone();
            }).catch(function (result) {
                /*
{ request: 
   { path: 'http://absent.o/12345',
     method: 'GET',
     canceled: false,
     cancel: [Function: cancel] },
  url: 'http://absent.o/12345',
  error: 
   { Error: getaddrinfo ENOTFOUND absent.o absent.o:80
    at errnoException (dns.js:50:10)
    at GetAddrInfoReqWrap.onlookup [as oncomplete] (dns.js:92:26)
     code: 'ENOTFOUND',
     errno: 'ENOTFOUND',
     syscall: 'getaddrinfo',
     hostname: 'absent.o',
     host: 'absent.o',
     port: 80 } }

                 */
                //console.log(result);
                done();
            });
    });

    it("invalid certificate host", function (done) {
        var faildone = make_faildone(done);
        rest('https://neverssl.com/12345')
            .then(function (response) {
                console.log('response', response);
                faildone();
            }).catch(function (result) {
                /*
{ request: 
   { path: 'https://neverssl.com/12345',
     method: 'GET',
     canceled: false,
     cancel: [Function: cancel] },
  url: 'https://neverssl.com/12345',
  error: 
   { Error: Hostname/IP doesn't match certificate's altnames: "Host: neverssl.com. is not in the cert's altnames: DNS:*.cloudfront.net, DNS:cloudfront.net"
    at Object.checkServerIdentity (tls.js:222:17)
    ... 
                 */
                //console.log(result);
                done();
            });
    });
       
    it("incorrect protocol", function (done) {
        var faildone = make_faildone(done);
        rest('tldr://paracamplus.com/12345')
            .then(function (response) {
                console.log('response', response);
                faildone();
            }).catch(function (result) {
                /*
Error: Protocol "tldr:" not supported. Expected "http:"
    at new ClientRequest (_http_client.js:131:11)

NOTA: this is an Error object not a Response!
                */
                //console.log(result);
                done();
            });
    });
        
    it("Required https", function (done) {
        var faildone = make_faildone(done);
        rest('http://auth.upmc.fr/')
            .timeout(3*1000)
            .then(function (response) {
                console.log('response', response);
                faildone();
            }).catch(function (result) {
                /*
{ TimeoutError: timed out after 3000ms
    at onTimeout (/home/queinnec/Paracamplus/ExerciseFrameWork-V2/JQuery/CodeGradXlib/node_modules/when/lib/decorators/timed.js:69:7)
    ...
                 */
                //console.log(result);
                done();
            });
    });
     
    it("bad port", function (done) {
        var faildone = make_faildone(done);
        rest('http://paracamplus.com:12345/')
            .then(function (response) {
                console.log('response', response);
                faildone();
            }).catch(function (result) {
                /*
{ request: 
   { path: 'http://paracamplus.com:12345/',
     method: 'GET',
     canceled: false,
     cancel: [Function: cancel] },
  url: 'http://paracamplus.com:12345/',
  error: 
   { Error: connect ECONNREFUSED 91.121.101.157:12345
    at Object._errnoException (util.js:1024:11)
    at _exceptionWithHostPort (util.js:1046:20)
    at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1182:14)
     code: 'ECONNREFUSED',
     errno: 'ECONNREFUSED',
     syscall: 'connect',
     address: '91.121.101.157',
     port: 12345 } }
                */
                //console.log(result);
                done();
            });
    });
        
    it("redirection 301", function (done) {
        var faildone = make_faildone(done);
        rest('http://cloud.google.com/')
            .then(function (response) {
                /*
{ request: 
   { path: 'http://cloud.google.com/',
     method: 'GET',
     canceled: false,
     cancel: [Function: cancel] },
  url: 'http://cloud.google.com/',
  raw: 
   { request: 
      ClientRequest {
        domain: null,
        _events: [Object],
        _eventsCount: 2,
        _maxListeners: undefined,
        output: [],
        outputEncodings: [],
        outputCallbacks: [],
        outputSize: 0,
        writable: true,
        _last: true,
        upgrading: false,
        chunkedEncoding: false,
        shouldKeepAlive: false,
        useChunkedEncodingByDefault: false,
        sendDate: false,
        _removedConnection: false,
        _removedContLen: false,
        _removedTE: false,
        _contentLength: 0,
        _hasBody: true,
        _trailer: '',
        finished: true,
        _headerSent: true,
        socket: [Object],
        connection: [Object],
        _header: 'GET / HTTP/1.1\r\nContent-Length: 0\r\nHost: cloud.google.com\r\nConnection: close\r\n\r\n',
        _onPendingData: [Function: noopPendingOutput],
        agent: [Object],
        socketPath: undefined,
        timeout: undefined,
        method: 'GET',
        path: '/',
        _ended: true,
        res: [Object],
        aborted: undefined,
        timeoutCb: null,
        upgradeOrConnect: false,
        parser: null,
        maxHeadersCount: null,
        [Symbol(outHeadersKey)]: [Object] },
     response: 
      IncomingMessage {
        _readableState: [Object],
        readable: false,
        domain: null,
        _events: [Object],
        _eventsCount: 2,
        _maxListeners: undefined,
        socket: [Object],
        connection: [Object],
        httpVersionMajor: 1,
        httpVersionMinor: 1,
        httpVersion: '1.1',
        complete: true,
        headers: [Object],
        rawHeaders: [Array],
        trailers: {},
        rawTrailers: [],
        upgrade: false,
        url: '',
        method: null,
        statusCode: 301,
        statusMessage: 'Moved Permanently',
        client: [Object],
        _consuming: true,
        _dumped: false,
        req: [Object],
        read: [Function] } },
  status: { code: 301 },
  headers: 
   { Location: 'https://cloud.google.com/',
     'X-Cloud-Trace-Context': '21ed3c5de7de67687544b56d0ef8f109',
     Date: 'Wed, 21 Mar 2018 17:38:25 GMT',
     'Content-Type': 'text/html',
     Server: 'Google Frontend',
     'Content-Length': '0',
     Connection: 'close' },
  entity: '' }
                */
                //console.log('response', response);
                expect(response.status.code).toBe(301);
                done();
            }).catch(faildone);
    });

    it("incorrect json but no error!", function (done) {
        var faildone = make_faildone(done);
        rest.wrap(mime)('http://www.codegradx.org/incorrect.json')
            .then(function (response) {
                console.log('response', response);
                faildone();
            }).catch(function (result) {
                /*
{ request: 
   { path: 'http://www.codegradx.org/incorrect.json',
     method: 'GET',
     canceled: false,
     cancel: [Function: cancel] },
  url: 'http://www.codegradx.org/incorrect.json',
  raw: 
   { request: 
      ClientRequest {
        domain: null,
        _events: [Object],
        _eventsCount: 2,
        _maxListeners: undefined,
        output: [],
        outputEncodings: [],
        outputCallbacks: [],
        outputSize: 0,
        writable: true,
        _last: true,
        upgrading: false,
        chunkedEncoding: false,
        shouldKeepAlive: false,
        useChunkedEncodingByDefault: false,
        sendDate: false,
        _removedConnection: false,
        _removedContLen: false,
        _removedTE: false,
        _contentLength: 0,
        _hasBody: true,
        _trailer: '',
        finished: true,
        _headerSent: true,
        socket: [Object],
        connection: [Object],
        _header: 'GET /incorrect.json HTTP/1.1\r\nContent-Length: 0\r\nHost: www.codegradx.org\r\nConnection: close\r\n\r\n',
        _onPendingData: [Function: noopPendingOutput],
        agent: [Object],
        socketPath: undefined,
        timeout: undefined,
        method: 'GET',
        path: '/incorrect.json',
        _ended: true,
        res: [Object],
        aborted: undefined,
        timeoutCb: null,
        upgradeOrConnect: false,
        parser: null,
        maxHeadersCount: null,
        [Symbol(outHeadersKey)]: [Object] },
     response: 
      IncomingMessage {
        _readableState: [Object],
        readable: false,
        domain: null,
        _events: [Object],
        _eventsCount: 2,
        _maxListeners: undefined,
        socket: [Object],
        connection: [Object],
        httpVersionMajor: 1,
        httpVersionMinor: 1,
        httpVersion: '1.1',
        complete: true,
        headers: [Object],
        rawHeaders: [Array],
        trailers: {},
        rawTrailers: [],
        upgrade: false,
        url: '',
        method: null,
        statusCode: 200,
        statusMessage: 'OK',
        client: [Object],
        _consuming: true,
        _dumped: false,
        req: [Object],
        read: [Function] } },
  status: { code: 200 },
  headers: 
   { Server: 'nginx/1.10.3',
     Date: 'Wed, 21 Mar 2018 17:52:34 GMT',
     'Content-Type': 'application/json',
     'Content-Length': '21',
     'Last-Modified': 'Wed, 21 Mar 2018 17:51:02 GMT',
     Connection: 'close',
     Etag: '"5ab29b86-15"',
     'Accept-Ranges': 'bytes' },
  entity: '{ "incorrect": json,\n' }

                */
                //console.log(result);
                done();
            });
    });
        

});
