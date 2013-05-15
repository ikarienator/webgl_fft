(function (global, undefined) {
    var canvas = document.querySelector('canvas'); //document.createElement('canvas');
    /**
     *
     * @type {WebGLContext}
     */
    var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    var support_texture_float = gl.getExtension('OES_texture_float');

    if (!support_texture_float) {
        console.error('Your browser does not support floating point texture.');
        return;
    }

    var vertexShaderSource = "\
\n\
attribute vec3 aPosition;\n\
varying vec2 vTexCoord;\n\
uniform int length;\n\
void main() {\n\
    gl_Position = vec4((aPosition - 0.5) * 2.0, 1.0);\n\
    vTexCoord = aPosition.xy + 1.0 / float(length);\n\
}";

    var fragmentShaderSource = "\
#ifdef GL_ES\n\
precision highp float;\n\
#endif\n\
varying vec2 vTexCoord;\n\
uniform int length;\n\
uniform sampler2D uTexture;\n\
void main() {\n\
    int index = int(vTexCoord.x * float(length));\n\
    gl_FragColor = vec4(vTexCoord.x - 1.0 / float(length), 0, 0, 1);\n\
}";

    var readBackShader = "\
#ifdef GL_ES\n\
precision highp float;\n\
#endif\n\
varying vec2 vTexCoord;\n\
uniform int length;\n\
uniform sampler2D uTexture;\n\
int mod(int a, int b) {\
    return a - b * (a / b);\
}\
vec4 mapFloatToBytes(float f) {\n\
    bool pos = f > 0.0;\n\
    if (!pos) f = -f;\n\
    int exponential = int(floor(log2(f)));\n\
    f *= pow(2.0, 24.0 - float(exponential));\n\
    f -= 16777216.0;\n\
    int b = int(floor(f + 0.5));\n\
    exponential += 127;\n\
    int posbit = pos ? 0 : 255;\n\
    return vec4(b - b / 256 * 256,\
        b / 256 - b / 256 / 256 * 256,\
        b / 256 / 256 + (exponential - exponential / 2 * 2),\
        exponential / 2 + posbit) / 255.0;\n\
}\n\
void main() {\n\
    int index = int(vTexCoord.x * float(length));\n\
    gl_FragColor = mapFloatToBytes(1.3); // texture2D(uTexture, vTexCoord);\n\
}";

    function createProgram(vertexShaderSource, fragmentShaderSource) {
        try {
            var success = false;
            var vertexShader = gl.createShader(gl.VERTEX_SHADER);
            gl.shaderSource(vertexShader, vertexShaderSource);
            gl.compileShader(vertexShader);
            if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
                throw "Failed to create vertex shader:\n" + gl.getShaderInfoLog(vertexShader);
            }

            var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
            gl.shaderSource(fragmentShader, fragmentShaderSource);
            gl.compileShader(fragmentShader);
            if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
                throw "Failed to create fragment shader:\n" + gl.getShaderInfoLog(fragmentShader);
            }

            program = gl.createProgram();
            // attach our two shaders to the program
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                throw "Failed to link program";
            }
            success = true;
            return program;
        } catch (e) {
            console.error(e);
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

    var program = createProgram(vertexShaderSource, fragmentShaderSource);
    var readBackProgram = createProgram(vertexShaderSource, readBackShader);
    var aPositionLocation = gl.getAttribLocation(program, "aPosition");

    var frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0, 0, 0,
        1, 0, 0,
        0, 1, 0,
        1, 1, 0
    ]), gl.STATIC_DRAW);
    var ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 2, 1, 3]), gl.STATIC_DRAW);


    function createTexture(length) {
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
            length, 1, 0, gl.RGBA,
            gl.FLOAT, new Float32Array(length * 4));
        return texture;
    }

    function createResultTexture(length) {
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
            length, 1, 0, gl.RGBA,
            gl.UNSIGNED_BYTE, new Uint8Array(length * 4));
        return texture;
    }

    function createTextures(n) {
        return [createTexture(n), createTexture(n), createResultTexture(n)];
    }

    // At the end of the day, texture[0] is the input, texture[1] is the output.
    function callFunction(program, textures, length) {
        // Output
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures[2], 0);

        // Input
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures[1]);

        gl.useProgram(program);
        gl.uniform1i(gl.getUniformLocation(program, "length"), length);

        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.enableVertexAttribArray(aPositionLocation);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0); // position
//        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, length, 1);
        gl.clearColor(1, 1, 1, 1);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }


    function readBack(textures, length) {
        // Output
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, textures[0], 0);

        // Input
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures[1]);

        gl.useProgram(readBackProgram);
        gl.uniform1i(gl.getUniformLocation(program, "length"), length);

        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.enableVertexAttribArray(aPositionLocation);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0); // position

        // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, length, 1);
        gl.clearColor(1, 1, 1, 1);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    }

    /**
     * Fast Fourier Transform of an array with size of a power of two.
     *
     * @param {Float32Array} array
     * @returns {Float32Array}
     */
    function fft(array) {
        var n = array.length;
        if (n == 0) {
            return new Float32Array(0);
        } else if (n == 1) {
            return new Float32Array([array[0], 0]);
        } else if (n != (n & ((~n) + 1))) {
            throw new Error("Invalid size. Must be a power of two.");
        } else {
            try {
                var textures = createTextures(n);
                var buffer = new Uint8Array(n * 4);
                var fbuffer = new Float32Array(buffer.buffer);
                callFunction(program, textures, n);
                readBack(textures, n);
                gl.bindTexture(gl.TEXTURE_2D, textures[2]);
                gl.readPixels(0, 0, n, 1, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
                console.log(fbuffer);
            } finally {
                gl.deleteTexture(textures[0]);
                gl.deleteTexture(textures[1]);
            }
        }
    }

    global.fft = fft;
})(this);