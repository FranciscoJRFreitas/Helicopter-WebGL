import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "./libs/utils.js";
import { ortho, lookAt, flatten, vec3 } from "./libs/MV.js";
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

    mode = gl.TRIANGLES; 

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

    gl.clearColor(0.0, 0.68, 0.93, 1.0);
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

    function Ground()
    {
        multTranslation([0.0, -0.025, 0.0]);
        multScale([50.0, 0.05 , 50.0]);
        
        uploadModelView();
        CUBE.draw(gl, program, mode);
    }

    function Body()
    {   
        multTranslation([0.0, 0.4, 0.0]);
        multScale([0.9, 0.5, 0.5]);

        uploadModelView();
        SPHERE.draw(gl, program, mode);
    }

    function Tail()
    {
        multTranslation([0.75, 0.5, 0.0]);
        multScale([0.9, 0.15, 0.15]);


        uploadModelView();
        SPHERE.draw(gl, program, mode);
    }

    function TailFin()
    {
        multTranslation([1.2, 0.6, 0.0]);
        multRotationZ(60);
        multScale([0.3, 0.15, 0.15]);

        uploadModelView();
        SPHERE.draw(gl, program, mode);
    }

    function Mast()
    {
        multTranslation([0.0, 0.7, 0.0]);
        multScale([0.025, 0.08, 0.025]);

        uploadModelView();
        CYLINDER.draw(gl, program, mode);
    }

    function TailMast()
    {
        multTranslation([1.2, 0.62, 0.1]);
        multRotationX(90);
        multScale([0.025, 0.08, 0.025]);

        uploadModelView();
        CYLINDER.draw(gl, program, mode);
    }

    function TailBlade()
    {
        multScale([0.4, 0.015, 0.02]);
        uploadModelView();
        SPHERE.draw(gl, program, mode);
    }

    function TailBlades()
    {
        pushMatrix();
            multTranslation([1.2, 0.62, 0.13]);
            multRotationZ(360*time);
            multTranslation([0.1, 0.0, 0.0]);
            TailBlade();
        popMatrix();
        pushMatrix();
            multTranslation([1.2, 0.62, 0.13]);
            multRotationZ(360*time);
            multRotationY(180);
            multTranslation([0.1, 0.0, 0.0]);
            TailBlade();
        popMatrix();

    }

    function landingSkid(){
        multScale([1, 0.01, 0.025]);

        uploadModelView();
        CYLINDER.draw(gl, program, mode); 
    }

    function LandingSkids()
    {
        pushMatrix();
            multTranslation([0.0, 0.0, 0.2]);
            landingSkid();
        popMatrix();
        pushMatrix();
            multTranslation([0.0, 0.0, -0.2]);
            landingSkid();
        popMatrix();
    }

    function Connection()
    {
        multScale([0.3, 0.015, 0.02]);

        uploadModelView();
        CUBE.draw(gl, program, mode);
    }

    function Connections()
    {
        pushMatrix();
            multTranslation([0.2, 0.108, 0.15]);
            multRotationX(-30);
            multRotationZ(-45);
            Connection();
        popMatrix();
        pushMatrix();
            multTranslation([0.2, 0.108, -0.15]);
            multRotationX(30);
            multRotationZ(-45);
            Connection();
        popMatrix();
        pushMatrix();
            multTranslation([-0.2, 0.108, 0.15]);
            multRotationX(-30);
            multRotationZ(45);
            Connection();
        popMatrix();
        pushMatrix();
            multTranslation([-0.2, 0.108, -0.15]);
            multRotationX(30);
            multRotationZ(45);
            Connection();
        popMatrix();
    }

    function Blade()
    {
        multTranslation([0.5, 0.7, 0.0]);
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

    function helicopter() 
    {
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
            TailMast();
        popMatrix();
        pushMatrix();
            multRotationY(360*time);
            Blades();
            Mast();
        popMatrix();
        pushMatrix();
            TailBlades();
        popMatrix();
        pushMatrix();
            LandingSkids()
        popMatrix(); 
        pushMatrix();
            Connections()
        popMatrix(); 
    }

    function render()
    {
        if(animation) time += speed;
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);

        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));

        loadMatrix(lookAt([ex,ey,ez], [0,0,0], [0,1,0]));

        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(0.8, 0.35, 0.5));

        pushMatrix();
            helicopter();
        popMatrix();

        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(0.08, 0.28, 0.2));

        pushMatrix();
            Ground();
        popMatrix();
    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))