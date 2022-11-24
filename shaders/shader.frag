precision highp float;

varying vec3 fNormal;

uniform vec3 uColor;

void main() {
        if(uColor == vec3(0.3, 0.3, 0.3))
                gl_FragColor = vec4(uColor, 1.0);
        if(uColor == vec3(0.2, 0.2, 0.2))
                gl_FragColor = vec4((fNormal * vec3(0.2,0.8,1.0)) * uColor,1.0);
        if(uColor == vec3(0.1, 0.1, 0.1))
                gl_FragColor = vec4((fNormal + vec3(1.0,1.0,1.0) * vec3(0.35,0.8,1.0)) * (uColor + vec3(0.3,0.3,0.3)),1.0);
        if(uColor == vec3(1, 0.0, 1))
                gl_FragColor = vec4(fNormal + uColor, 1.0);
        if(uColor == vec3(0.6, 0.3, 0.0))
                gl_FragColor = vec4(uColor,1.0);
        if(uColor == vec3(0.3, 0.15, 0.0))
                gl_FragColor = vec4(uColor,1.0);
        if(uColor == vec3(0.4, 0.4, 0.4))
                gl_FragColor = vec4((fNormal * vec3(0.25,0.85,1.0)) * uColor,1.0);
        if(uColor == vec3(1.0, 0.3, 0.3))
                gl_FragColor = vec4(uColor * (vec3(1.0,0.1,0.8) + fNormal),1.0);
        if(uColor == vec3(0.0, 0.6, 0.09))
                gl_FragColor = vec4(uColor,1.0);
                

}