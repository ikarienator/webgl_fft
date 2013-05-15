#ifdef GL_ES
precision highp float;
#endif
varying vec2 vTexCoord;
uniform int depth;
uniform int length;
uniform int step;
uniform sampler2D uTexture;

#include "packing.include.glsl"

int reverseBit(int n) {
    int rev = 0;
    for (int i = 2; i < 16; i++) {
        rev += rev;
        rev += n - n / 2 * 2;
        n /= 2;
        if (i == depth) return rev;
    }
    return rev;
}

void main() {
    int index = int(vTexCoord.x * float(length));
    if (index == index / 2 * 2)
        // Real part
        gl_FragColor = f2b(get(reverseBit(index / 2) * 2));
    else
        // Imag part
        gl_FragColor = f2b(get(reverseBit(index / 2) * 2 + 1));
}