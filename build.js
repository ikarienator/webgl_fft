var fs = require('fs');
var script_base_url = '/src/';
scripts = null;
var include_re = /^#include\s*"([\w\.]+?)"\s*$/gm;
var rel_re = /(\/[^\/]+\/\.\.)|([^\/]+\/\.\.\/?)/g;
var loadingCache = {};

function loadShader(file, base_url) {
    if (loadingCache[file]) {
        return loadingCache[file];
    }

    var nf = file.replace(rel_re, '');
    while (nf != file) {
        file = nf;
        nf = file.replace(rel_re, '');
    }
    if (file.charAt(0) == '/') {
        var code = fs.readFileSync(__dirname + file, 'utf-8');
        code = code.replace(include_re, function (text, included_file) {
            return loadShader(included_file, file);
        });
        return loadingCache[file] = code;
    }
    if (!base_url) {
        base_url = script_base_url;
    }
    if (base_url.charAt(base_url.length - 1) == '/') {
        return loadShader(base_url + file);
    } else {
        return loadShader(base_url.substring(0, base_url.lastIndexOf('/') + 1) + file);
    }
}

var code = fs.readFileSync(__dirname + '/src/webgl_fft.js', 'utf-8');
code = code.replace(/loadShader\("(.*?)"\)/gm, function(code, file){
    return '\n' + JSON.stringify(loadShader(file)).replace(/\\n/g, '\\n\\\n');
});
fs.writeFileSync('webgl_fft.build.js', code, 'utf-8');