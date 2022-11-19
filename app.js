import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "./libs/utils.js";
import { ortho, lookAt, flatten, vec3, scale, rotateX, rotateZ } from "./libs/MV.js";
import {modelView, loadMatrix, multRotationY, multScale, multTranslation, popMatrix, pushMatrix, multRotationX, multRotationZ} from "./libs/stack.js";

import * as SPHERE from './libs/objects/sphere.js';
import * as CUBE from './libs/objects/cube.js';
import * as CYLINDER from './libs/objects/cylinder.js';

const VELOCITY_FACTOR = 0.5;
const MAXIMUM_VELOCITY_LEVEL = 8;
const CEILING = 10;
const FLOOR = 0;
const SPEED = 0.005; // Speed (how many time units added to time on each render pass
const SECOND = 60 * SPEED; //Speed increments one time per second.
let unitsAwayFromCenter = 2.0; // radius of helicopter s circular movement | CONSTANT VS VARIABLE

/** @type WebGLRenderingContext */
let gl;
let time = 0;           // Global simulation time
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let s = 0.3;            //World Scale
let motorVelocity = 0;
let height = 0;
let isMovingLeft = false;
let boxesNum = 0;
let boxes = [];

let leaningAngle = 0; //Not supposed to change
let heliTime = 0;
let bladeTime = 0;
let mView = lookAt([1,1,1], [0,0,0], [0,1,0]);


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
                if(motorVelocity < MAXIMUM_VELOCITY_LEVEL) {
                    motorVelocity++;
                }
            break;
            case "ArrowDown":
                if(motorVelocity > 0) {
                    motorVelocity--;
                }
            break;
            case "ArrowLeft":
                isMovingLeft = true;
               break;
            case "1":
                mView = lookAt([1,1,1], [0,0,0], [0,1,0]);
            break;
            case "2":
                mView = lookAt([1, 0.6, 0], [0, 0.6, 0.0], [0,1,0]);
            break;
            case "3":
                mView = lookAt([0, 1.6, 0], [0, 0.6, 0.0], [0,0,-1]);
            break;
            case "4":
                mView = lookAt([0, 0.6, 1], [0, 0.6, 0.0], [0,1,0]);
                ;
            break;
            case "r":
                if(s-0.1 > 0.00001)
                    s -= 0.1;
            break;
            case "f":
                if(s+0.05 < 10)
                    s += 0.05;
            break;
            case "s":
                mode = gl.TRIANGLES;
            break;
            case "w":
                mode = gl.LINES;
            break;

        }
    };
    let k = 0;
    document.onkeyup = function(event) {
        switch(event.key) {
            case "ArrowLeft":
                isMovingLeft = false;
            break;
            case " ":
                boxes.push({height: height, heliTime: heliTime, boxTime: 0, reachedGround: 1, reachGroundTime: 0, motorVelocity: motorVelocity}); //reachedGround: variable to make boxes stop at y = 0.
                boxesNum++
            break;
        }
    }

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
        mProjection = ortho(-aspect, aspect, -1, 1, -3, 3);
    }

    function uploadModelView()
    {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mModelView"), false, flatten(modelView()));
    }

    const BOX_GRAVITY = 0.5;
    let boxThrowMovement = 0;
    function DropBox()
    {
        for(let b of boxes){
            b.boxTime += SPEED;
            if(b.boxTime - SPEED <= 5 * SECOND) {
            pushMatrix();
                b.height = b.height - b.boxTime**2 * BOX_GRAVITY;
                if(b.height <= 0.0) //If box reaches ground
                    b.reachedGround = 0;
                else
                    b.reachGroundTime += SPEED; //reachGroundTime stops incrementing when it reaches the ground
                multRotationY((360 * b.heliTime) - 45);
                boxThrowMovement = (unitsAwayFromCenter - unitsAwayFromCenter/3.5) + (b.reachGroundTime * b.motorVelocity)/3;
                multTranslation([boxThrowMovement, b.height * b.reachedGround , boxThrowMovement]);
                multRotationY(90 * b.reachGroundTime);
                CargoBox();
            popMatrix();
            }
        else
            boxes.splice(boxes.indexOf(b),1);
        }
    }

    function Ground()
    {
        pushMatrix();
        multTranslation([0.0, -0.025, 0.0]);
        multScale([50.0, 0.05 , 50.0]);
        
        uploadModelView();
        CUBE.draw(gl, program, mode);
        popMatrix();
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
        multTranslation([0.0, 0.68, 0.0]);
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
            multTranslation([0.1, 0.0, 0.0]);
            TailBlade();
        popMatrix();
        pushMatrix();
            multRotationY(180);
            multTranslation([0.1, 0.0, 0.0]);
            TailBlade();
        popMatrix();

    }

    function landingSkid()
    {
        multScale([1, 0.03, 0.025]);

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
            multTranslation([0.2, 0.1, 0.15]);
            multRotationX(-30);
            multRotationZ(-45);
            Connection();
        popMatrix();
        pushMatrix();
            multTranslation([0.2, 0.1, -0.15]);
            multRotationX(30);
            multRotationZ(-45);
            Connection();
        popMatrix();
        pushMatrix();
            multTranslation([-0.2, 0.1, 0.15]);
            multRotationX(-30);
            multRotationZ(45);
            Connection();
        popMatrix();
        pushMatrix();
            multTranslation([-0.2, 0.1, -0.15]);
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

    function HelicopterParts() 
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
            multRotationY(360 * bladeTime);
            Blades();
            Mast();
        popMatrix();
        pushMatrix();
            multTranslation([1.2, 0.62, 0.13]);
            multRotationZ(360 * bladeTime);
            TailBlades();
        popMatrix();
        pushMatrix();
            LandingSkids()
        popMatrix(); 
        pushMatrix();
            Connections()
        popMatrix(); 
    }

    function updateHeight()
    {   
        let heightFactorOnSpeed = height * 0.3; //Controls the blade speed according to the height
        //(the highest the helicopter is, the fastest the blades spin)
        if(motorVelocity == 0){
           height -= 0.04 * VELOCITY_FACTOR;
           if(height > 0) //When the helicopter is falling
           bladeTime += heightFactorOnSpeed * SPEED * VELOCITY_FACTOR*3;
        }else{
            bladeTime += (heightFactorOnSpeed + 0.2) * SPEED * motorVelocity * VELOCITY_FACTOR*3; //Smoothing the blade stopping animation
        if(motorVelocity == 1)
            height -= 0.01 * VELOCITY_FACTOR;
        if(motorVelocity == 2)
            height -= 0.005 * VELOCITY_FACTOR;
        if(motorVelocity == 4)
            height += 0.0025 * VELOCITY_FACTOR;
        if(motorVelocity == 5)
            height += 0.005 * VELOCITY_FACTOR;
        if(motorVelocity == 6)
            height += 0.0075 * VELOCITY_FACTOR;
        if(motorVelocity == 7)
            height += 0.01 * VELOCITY_FACTOR;
        if(motorVelocity == 8)
            height += 0.02 * VELOCITY_FACTOR;
        }

        if(height < FLOOR)
            height = FLOOR;
        else if (height > CEILING)
            height = CEILING;
    }

    function HelicopterMovement()
    {
            updateHeight();
            multTranslation([unitsAwayFromCenter, height, 0.0]); // Initial Helicopter pos
            multRotationY(-90);
            if(isMovingLeft && height > FLOOR) { // Can move only when it s in the air and key is pressed.
                heliTime += SPEED * (motorVelocity + 1) * VELOCITY_FACTOR/5; //(motorVelocity + 1) so that it can move left while falling
                multTranslation([0.0, 0.0, unitsAwayFromCenter]); // Translation to rotation on Y.
                multRotationY(360 * heliTime);
                multTranslation([unitsAwayFromCenter, 0, 0.0]); // Radius of Y rotation
                multRotationY(-90); // Helicopter front in direction to the movement.
                leaningAngle < 0 ? leaningAngle = 0 : leaningAngle = leaningAngle + 0.5;
                multRotationX(leaningAngle/MAXIMUM_VELOCITY_LEVEL * motorVelocity);// Helicopter twisting sideways to make left movement realistic.
                multRotationZ(leaningAngle/MAXIMUM_VELOCITY_LEVEL * motorVelocity); // Helicopter Z angle (30 dg maximum) that changes acording to speed
                //Stabilization
                if(leaningAngle >= 30) //gradual acceleration
                    leaningAngle = leaningAngle - 0.5;
                if(leaningAngle >= 1 && height <= 0.27) //soft landing
                    leaningAngle--;
                    if(motorVelocity <= 1) //So that the helicopter model doesnt enter the ground.
                        leaningAngle <= 0 ? leaningAngle = -0.1 : leaningAngle = leaningAngle - 3;
            }
            else{
                multTranslation([0.0, 0.0, unitsAwayFromCenter]);
                multRotationY(360 * heliTime);
                multTranslation([unitsAwayFromCenter, 0, 0.0]);
                multRotationY(-90);
                //Stabilization mechanism
                if(leaningAngle > 0){
                    leaningAngle = leaningAngle - 0.5;
                    multRotationX(leaningAngle);
                    multRotationZ(leaningAngle);
                    if(leaningAngle >= 1 && height <= 0.27) //soft landing
                        leaningAngle--;
                } else
                    leaningAngle = 0;
                
            }
    }

    function Helicopter()
    {
        pushMatrix();
            HelicopterMovement();
            HelicopterParts();
        popMatrix();

    }

    function CargoBoxSide() 
    {
        multTranslation([0.0, 0.425, 0.52]);
        multScale([1.0,0.1,0.1]);
        uploadModelView();
        CUBE.draw(gl, program, mode);
    }

    function Cross()
    {
        multRotationZ(45);
            pushMatrix();
                multTranslation([0.0, -0.2125, 0.0]);
                multScale([1.06,0.5,1.0]);
                CargoBoxSide();
            popMatrix();
            pushMatrix();
                multTranslation([0.2125,0.0, 0.0]);
                multRotationZ(90);
                multScale([1.06,0.5,1.0]);
                CargoBoxSide();
            popMatrix();
    }

    function CargoBoxFaceSides() 
    {
        pushMatrix();
            CargoBoxSide();
        popMatrix();
        pushMatrix();
            multTranslation([0.0,-0.85,0.0]);
            CargoBoxSide();
        popMatrix();
        pushMatrix();
            multRotationZ(90);
            CargoBoxSide();
        popMatrix();
        pushMatrix();
            multRotationZ(-90);
            CargoBoxSide();
        popMatrix();
    }

    function CargoBody()
    {
            uploadModelView();
            CUBE.draw(gl, program, mode);
    }

    function CargoBox()
    {
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(0.6, 0.3, 0.0)); //Box color

        pushMatrix();
            multTranslation([0.0, 0.5, 0.0]);
            multScale([0.2,0.2,0.2]);
            pushMatrix();
                CargoBody();
            popMatrix();
            gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(0.3, 0.15, 0.0)); //Sides color
            //left face
            pushMatrix();
                CargoBoxFaceSides();
            popMatrix();
            //top face
            pushMatrix();
                multRotationX(-90);
                pushMatrix();
                    Cross();
                popMatrix();
                CargoBoxFaceSides();
            popMatrix();
            //front face
            pushMatrix();
                multRotationY(90);
                CargoBoxFaceSides();
            popMatrix();
            //right face
            pushMatrix();
                multRotationY(-90);
                CargoBoxFaceSides();
            popMatrix();
            //bottom face
            pushMatrix();
                multRotationX(90);
                CargoBoxFaceSides();
            popMatrix();
            //back face
            pushMatrix();
                multRotationX(180);
                CargoBoxFaceSides();
            popMatrix();
        popMatrix();
    }


    function World()
    {
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(1, 0.0, 1.0)); //Helicopter color

        Helicopter();

        pushMatrix();
            multTranslation([0.0,-0.4,0.0]);
            CargoBox();
            DropBox();
        popMatrix();

        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(.2, .2, .2));

        //reference box
        /*pushMatrix();
            multTranslation([0.0, 0.5, 0.0]);
            uploadModelView();
            CUBE.draw(gl, program, mode);
        popMatrix();
        */

        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(0.08, 0.28, 0.2)); //Ground color

        Ground();
    }

    function render()
    {
        document.getElementById("height").innerHTML = Number((height).toFixed(1));
        document.getElementById("boxes").innerHTML = boxes.length;
        time += SPEED;
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        gl.useProgram(program);

        gl.uniformMatrix4fv(gl.getUniformLocation(program, "mProjection"), false, flatten(mProjection));

        loadMatrix(mView);

        pushMatrix();
            multScale([s, s, s]);
            World();
        popMatrix();

    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))