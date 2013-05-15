attribute vec3 aPosition;
varying vec2 vTexCoord;
uniform int length;
void main() {
    gl_Position = vec4((aPosition - 0.5) * 2.0, 1.0);
    vTexCoord = aPosition.xy - 0.5 / float(length);
}