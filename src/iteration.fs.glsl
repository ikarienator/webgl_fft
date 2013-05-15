#ifdef GL_ES
precision highp float;
#endif
varying vec2 vTexCoord;
uniform int depth;
uniform int length;
uniform int step;
uniform sampler2D uTexture;

#include "packing.include.glsl"

void main() {
    int index = int(vTexCoord.x * float(length));
    int i = index / 2;
    int m = int(pow(2.0, float(step)));
    int k = i - i / m * m;
    float or = cos(3.1415926535 * float(k) / float(m));
    float oi = -sin(3.1415926535 * float(k) / float(m));
    bool left = (i - i / m / 2 * m * 2) / m == 0; // i % 2m / m == 0;
    // If on the left branch
    if (left) {
        if (index == index / 2 * 2) {
            // Real part
            float r1 = get(index);
            float i1 = get(index + 1);
            float r2 = get(index + m * 2);
            float i2 = get(index + m * 2 + 1);
            float tr = or * r2 - oi * i2;
            float ti = or * i2 + oi * r2;
            gl_FragColor = f2b(r1 + tr);
        } else {
            // Imag part
            float r1 = get(index - 1);
            float i1 = get(index);
            float r2 = get(index + m * 2 - 1);
            float i2 = get(index + m * 2);
            float tr = or * r2 - oi * i2;
            float ti = or * i2 + oi * r2;
            gl_FragColor = f2b(i1 + ti);
        }
    } else {
        if (index == index / 2 * 2) {
            // Real part
            float r1 = get(index - m * 2);
            float i1 = get(index - m * 2 + 1);
            float r2 = get(index);
            float i2 = get(index + 1);
            float tr = or * r2 - oi * i2;
            float ti = or * i2 + oi * r2;
            gl_FragColor = f2b(r1 - tr);
        } else {
            // Imag part
            float r1 = get(index - m * 2 - 1);
            float i1 = get(index - m * 2);
            float r2 = get(index - 1);
            float i2 = get(index);
            float tr = or * r2 - oi * i2;
            float ti = or * i2 + oi * r2;
            gl_FragColor = f2b(i1 - ti);
        }
    }
}