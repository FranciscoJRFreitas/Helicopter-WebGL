precision highp float;

varying vec3 fNormal;

uniform vec3 uColor;

void main() {
        gl_FragColor = vec4(uColor,1.0);
        if(uColor == vec3(0.1, 0.1, 0.1))
                gl_FragColor = vec4((fNormal + vec3(1.0,0.8,1.7) * vec3(1.35,1.2,0.8)) * (uColor + vec3(0.3,0.3,1.3)), 1.0);
        else if(uColor == vec3(0.2, 0.2, 0.2))
                gl_FragColor = vec4((fNormal * vec3(0.8,0.8,1.0)) * uColor, 1.0);
        else if(uColor == vec3(1.0, 0.3, 0.3))
                gl_FragColor = vec4((fNormal + vec3(1.0,0.1,0.8)) * uColor, 1.0);
        else if(uColor == vec3(0.4, 0.4, 0.4))
                gl_FragColor = vec4((fNormal * vec3(0.25,1.35,1.0)) * uColor, 1.0);
        else if(uColor == vec3(1, 0.0, 1))
                gl_FragColor = vec4(fNormal + uColor, 1.0);
}