import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "./libs/utils.js";
import { ortho, lookAt, flatten, rotateY } from "./libs/MV.js";
import {modelView, loadMatrix, multRotationY, multScale, multTranslation, popMatrix, pushMatrix, multRotationX, multRotationZ} from "./libs/stack.js";

import * as SPHERE from './libs/objects/sphere.js';
import * as CUBE from './libs/objects/cube.js';
import * as CYLINDER from './libs/objects/cylinder.js';

/** @type WebGLRenderingContext */
let gl;

let time = 0;           // Global simulation time in days
let speed = 0.005;     // Speed (how many days added to time on each render pass
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let animation = true;   // Animation is running
let ex = 1;
let ey = 1;
let ez = 1;

function setup(shaders)
{
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    let mProjection = ortho(-aspect, aspect, -1, 1,-3,3);

    mode = gl.LINES; 

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    document.onkeydown = function(event) {
        switch(event.key) {
            case "ArrowUp":
                ey -= 0.05;
            break;
            case "ArrowDown":
                ey += 0.05;
            break;
            case "ArrowLeft":
                ex -= 0.05;
               break;
            case "ArrowRight":
                ex += 0.05;
            break;
            case "a":
                ez -= 0.05;
            break;
            case "d":
                ez += 0.05;
            break;
            case "s":
                if(mode === gl.LINES)
                    mode = gl.TRIANGLES;
                else
                mode = gl.LINES;
            break;
        }
    };

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    SPHERE.init(gl);
    CUBE.init(gl);
    CYLINDER.init(gl);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
    
    window.requestAnimationFrame(render);


    function resize_canvas(event)
    {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0,0,canvas.width, canvas.height);
        mProjection = ortho(-aspect, aspect, -1, 1,-3,3);
    }

    function uploadModelView()
    {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
    }

    function Body()
    {
        multScale([0.9, 0.5, 0.5]);

        uploadModelView();
        SPHERE.draw(gl, program, mode);
    }

    function Tail()
    {
        multTranslation([0.75, 0.1, 0.0]);
        multScale([0.9, 0.15, 0.15]);


        uploadModelView();
        SPHERE.draw(gl, program, mode);
    }

    function TailFin()
    {
        multTranslation([1.2, 0.165, 0.0]);
        multRotationZ(60);
        multScale([0.3, 0.15, 0.15]);


        uploadModelView();
        SPHERE.draw(gl, program, mode);
    }

    function Mast()
    {
        multTranslation([0.0, 0.3, 0.0]);
        multScale([0.025, 0.08, 0.025]);

        uploadModelView();
        CYLINDER.draw(gl, program, mode);
    }

    function TailRotor()
    {
        multTranslation([1.22, 0.175, 0.1]);
        multRotationX(90);
        multScale([0.025, 0.08, 0.025]);

        uploadModelView();
        CYLINDER.draw(gl, program, mode);
    }

    function TailBlade()
    {
        multTranslation([1.32, 0.175, 0.11]);
        multScale([0.2, 0.015, 0.015]);

        uploadModelView();
        SPHERE.draw(gl, program, mode);
    }

    function Blade()
    {
        multTranslation([0.5, 0.3, 0.0]);
        multScale([1.0, 0.015, 0.05]);

        uploadModelView();
        SPHERE.draw(gl, program, mode);
    }

    function Blades()
    {
        pushMatrix();
            Blade();
        popMatrix();
        pushMatrix();
            multRotationY(90);
            Blade();
        popMatrix();
        pushMatrix();
            multRotationY(180);
            Blade();
        popMatrix();
        pushMatrix();
            multRotationY(270);
            Blade();
        popMatrix();
    }


    function TailBlades()
    {
        pushMatrix();
            TailBlade();
        popMatrix();
        /*pushMatrix();
            TailBlade();
        popMatrix();*/
        /*Segunda tailblade a adicionar*/
    }

    function render()
    {
        if(animation) time += speed;
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);
        
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));

        loadMatrix(lookAt([ex,ey,ez], [0,0,0], [0,1,0]));
        
        pushMatrix();
            Body();
        popMatrix();
        pushMatrix();
            Tail();
        popMatrix();
        pushMatrix();
            TailFin();
        popMatrix();
        pushMatrix();
            TailRotor();
        popMatrix();
        pushMatrix();
            multRotationY(360*time);
            Blades();
            Mast();
        popMatrix();
        pushMatrix();
            TailBlades();
        popMatrix();
        /*
        pushMatrix();
            multRotationY(360*time/VENUS_YEAR);
            multTranslation([VENUS_ORBIT, 0, 0]);
            Venus();
        popMatrix();
        pushMatrix();
            multRotationY(360*time/EARTH_YEAR);
            multTranslation([EARTH_ORBIT, 0, 0]);
            EarthAndMoon();
        popMatrix();*/
    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))