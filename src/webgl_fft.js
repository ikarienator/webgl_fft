(function (exports, undefined) {
    var scripts = document.querySelectorAll('script');
    var script_base_url = scripts[scripts.length - 1].src;
    scripts = null;
    var canvas = document.createElement('canvas');
    var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    var MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE);
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
        if (file.substring(0, 7) == 'http://' ||
                file.substring(0, 8) == 'https://') {
            console.log('Fetching ' + file);
            var xhr = new XMLHttpRequest();
            xhr.open("GET", file, false);
            xhr.send(null);
            var code = xhr.responseText;
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

    function createProgram(calculation) {
        try {
            var success = false;
            var vertexShader = gl.createShader(gl.VERTEX_SHADER);
            gl.shaderSource(vertexShader, vertexShaderSource);
            gl.compileShader(vertexShader);
            if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
                throw "Failed to create vertex shader:\n" + gl.getShaderInfoLog(vertexShader);
            }

            var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
            gl.shaderSource(fragmentShader, calculation);
            gl.compileShader(fragmentShader);
            if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
                throw "Failed to create fragment shader:\n" + gl.getShaderInfoLog(fragmentShader);
            }

            var program = gl.createProgram();
            // attach our two shaders to the program
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                throw "Failed to link program";
            }

            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
            gl.enableVertexAttribArray(gl.getAttribLocation(program, "aPosition"));
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0); // position

            gl.useProgram(program);
            program.lengthLocation = gl.getUniformLocation(program, "length");
            program.depthLocation = gl.getUniformLocation(program, "depth");
            program.stepLocation = gl.getUniformLocation(program, "step");
            gl.uniform1i(gl.getUniformLocation(program, "uTexture"), 0);

            success = true;
            return program;
        } finally {
            if (!success) {
                if (program) {
                    gl.deleteProgram(program);
                    program = undefined;
                }
                if (vertexShader) {
                    gl.deleteShader(vertexShader);
                }
                if (fragmentShader) {
                    gl.deleteShader(fragmentShader);
                }
            }
        }
    }

    function createTexture() {
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        return texture;
    }

    function setupInput(array) {
        var length = array.length;
        if (length < MAX_TEXTURE_SIZE) {
            gl.bindTexture(gl.TEXTURE_2D, working_textures[0]);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                    length, 1, 0, gl.RGBA,
                    gl.UNSIGNED_BYTE, null);
            gl.bindTexture(gl.TEXTURE_2D, working_textures[1]);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                    length, 1, 0, gl.RGBA,
                    gl.UNSIGNED_BYTE, new Uint8Array(array.buffer));
        } else {
            gl.bindTexture(gl.TEXTURE_2D, working_textures[0]);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                    MAX_TEXTURE_SIZE, length / MAX_TEXTURE_SIZE, 0, gl.RGBA,
                    gl.UNSIGNED_BYTE, null);
            gl.bindTexture(gl.TEXTURE_2D, working_textures[1]);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                    MAX_TEXTURE_SIZE, length / MAX_TEXTURE_SIZE, 0, gl.RGBA,
                    gl.UNSIGNED_BYTE, new Uint8Array(array.buffer));
        }
    }

    function callProgram(program, step) {
        // Output
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, working_textures[0], 0);

        // Input
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, working_textures[1]);

        gl.useProgram(program);
        gl.uniform1i(program.stepLocation, step);

        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

        var temp = working_textures[1];
        working_textures[1] = working_textures[0];
        working_textures[0] = temp;
    }

    function readBack(array) {
        var length = array.length;
        var buffer = new Uint8Array(array.buffer);
        gl.bindTexture(gl.TEXTURE_2D, working_textures[2]);
        gl.readPixels(0, 0, length, 1, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
    }

    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]), gl.STATIC_DRAW);
    var ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 2, 1, 3]), gl.STATIC_DRAW);

    var vertexShaderSource = loadShader("mapping.vs.glsl");
    var conj = createProgram(loadShader("butterfly_conj.fs.glsl"));
    var butterfly = createProgram(loadShader("butterfly.fs.glsl"));
    var iteration = createProgram(loadShader("iteration.fs.glsl"));
    var working_textures = [createTexture(), createTexture(), createTexture()];

    var frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

    /**
     * Fast Fourier Transform of an array with size of a power of two.
     *
     * @param {Float32Array} array
     * @returns {Float32Array}
     */
    function fft(array) {
        var n = array.length;
        if (n > 2) {
            if (n != (n & ((~n) + 1))) {
                throw new Error("Invalid size. Must be a power of two.");
            } else {
                setupInput(array);
                gl.viewport(0, 0, n, 1);
                gl.useProgram(butterfly);
                gl.uniform1i(butterfly.lengthLocation, n);
                gl.uniform1i(butterfly.depthLocation, Math.floor(Math.log(n) / Math.log(2) + 0.1));
                gl.useProgram(iteration);
                gl.uniform1i(iteration.lengthLocation, n);
                gl.uniform1i(iteration.depthLocation, Math.floor(Math.log(n) / Math.log(2) + 0.1));

                callProgram(butterfly, 0);
                for (var i = 0, m = 2; m < n; i++, m <<= 1) {
                    callProgram(iteration, i);
                }
                readBack(array);
            }
        }
    }

    /**
     * Inverse Fast Fourier Transform of an array with size of a power of two.
     *
     * @param {Float32Array} array
     * @returns {Float32Array}
     */
    function ifft(array) {
        var n = array.length;
        if (n > 2) {
            if (n != (n & ((~n) + 1))) {
                throw new Error("Invalid size. Must be a power of two.");
            } else {
                setupInput(array);
                gl.viewport(0, 0, n, 1);
                gl.useProgram(conj);
                gl.uniform1i(conj.lengthLocation, n);
                gl.uniform1i(conj.depthLocation, Math.floor(Math.log(n) / Math.log(2) + 0.1));
                gl.useProgram(iteration);
                gl.uniform1i(iteration.lengthLocation, n);
                gl.uniform1i(iteration.depthLocation, Math.floor(Math.log(n) / Math.log(2) + 0.1));

                callProgram(conj, 0);
                for (var i = 0, m = 2; m < n; i++, m <<= 1) {
                    callProgram(iteration, i);
                }
                readBack(array);
            }
        }
    }

    exports.fft = fft;
    exports.ifft = ifft;
})(this.webgl_fft || (this.webgl_fft = {}));