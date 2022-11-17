precision highp float;

varying vec3 fNormal;

uniform vec3 uColor;

void main() {
        if(uColor == vec3(0.08, 0.28, 0.2))
                gl_FragColor = vec4(uColor, 1.0);
        else{
                if(uColor == vec3(0.2, 0.2, 0.2))
                        gl_FragColor = vec4(uColor * fNormal,1.0);
                else
                        gl_FragColor = vec4(fNormal, 1.0);
        }
}