import { buildProgramFromSources, loadShadersFromURLS, setupWebGL } from "./libs/utils.js";
import { ortho, lookAt, flatten, vec3, scale, rotateX, rotateZ, rotateY, rotate, mult, translate } from "./libs/MV.js";
import {modelView, loadMatrix, multRotationY, multScale, multTranslation, popMatrix, pushMatrix, multRotationX, multRotationZ} from "./libs/stack.js";

import * as SPHERE from './libs/objects/sphere.js';
import * as CUBE from './libs/objects/cube.js';
import * as CYLINDER from './libs/objects/cylinder.js';
import * as PYRAMID from './libs/objects/pyramid.js';
import * as BUNNY from './libs/objects/bunny.js';
import * as TORUS from './libs/objects/torus.js';

const VELOCITY_FACTOR = 0.5;
const MAXIMUM_VELOCITY_LEVEL = 8;
const CEILING = 15;
const FLOOR = 0;
const SPEED = 0.005; // Speed (how many time units added to time on each render pass
const SECOND = 60 * SPEED; //Speed increments one time per second.
const SCALE = 0.16; //World Scale
let unitsAwayFromCenter = 4.0; // radius of helicopter s circular movement | CONSTANT VS VARIABLE

/** @type WebGLRenderingContext */
let gl;
let time = 0;           // Global simulation time
let mode;               // Drawing mode (gl.LINES or gl.TRIANGLES)
let s = SCALE;            
let motorVelocity = 0;
let height = 0;
let isMovingLeft = false;
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

    let mProjection = ortho(-aspect, aspect, -1, 1,-5,5);

    mode = gl.TRIANGLES; 

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    document.getElementById("x").innerHTML = 0;
    document.getElementById("y").innerHTML = 0;
    document.getElementById("scale").innerHTML = SCALE;
    document.getElementById("s").innerHTML = s / SCALE * 100;

    document.getElementById("normalView").onclick = function changeNormalView() {
        mView = lookAt([1,1,1], [0,0.1,0], [0,1,0]);
        document.getElementById("x").innerHTML = 0;
        document.getElementById("y").innerHTML = 0;
        document.getElementById("xRotation").value = 0;
        document.getElementById("yRotation").value = 0;
    }

    document.getElementById("frontView").onclick = function changeFrontView() {
        mView = lookAt([1, 0.5, 0], [0, 0.5, 0.0], [0,1,0]);
        document.getElementById("x").innerHTML = 0;
        document.getElementById("y").innerHTML = -45;
        document.getElementById("xRotation").value = 0;
        document.getElementById("yRotation").value = -45;
    }

    document.getElementById("topView").onclick = function changeTopView() {
        mView = lookAt([0, 1.5, 0], [0, 0.5, 0.0], [0,0,-1]);
        document.getElementById("x").innerHTML = 90;
        document.getElementById("y").innerHTML = 45;
        document.getElementById("xRotation").value = 90;
        document.getElementById("yRotation").value = 45;
    }

    document.getElementById("rightSideView").onclick = function changeRightSideView() {
        mView = lookAt([0, 0.5, 1], [0, 0.5, 0.0], [0,1,0]);
        document.getElementById("x").innerHTML = -19;
        document.getElementById("y").innerHTML = 45;
        document.getElementById("xRotation").value = -19;
        document.getElementById("yRotation").value = 45;
    }

    document.getElementById("cameraRotation").oninput = function Rotate() {
        let angleX = document.getElementById("xRotation").value;
        let angleY = document.getElementById("yRotation").value;
        document.getElementById("x").innerHTML = angleX;
        document.getElementById("y").innerHTML = angleY;
        
        mView = mult(lookAt([1.0, 0.5, 1.0], [-5.0, -2.5, -5.0], [0,1,0]), mult(rotateY(angleY), rotateX(angleX)));
    }

    document.getElementById("cameraScale").oninput = function Rotate() {
        s = document.getElementById("scale").value;
        document.getElementById("s").innerHTML = Number((s / SCALE * 100).toFixed(1));;
    }

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
            case "s":
                mode = gl.TRIANGLES;
            break;
            case "w":
                mode = gl.LINES;
            break;

        }
    };
    document.onkeyup = function(event) {
        switch(event.key) {
            case "ArrowLeft":
                isMovingLeft = false;
            break;
            case " ":
                boxes.push({height: height, heliTime: heliTime, boxTime: 0, reachedGround: 1, reachGroundTime: 0, motorVelocity: motorVelocity}); //reachedGround: variable to make boxes stop at y = 0.
            break;
        }
    }

    gl.clearColor(0.0, 0.68, 0.93, 1.0);
    SPHERE.init(gl);
    CUBE.init(gl);
    CYLINDER.init(gl);
    PYRAMID.init(gl);
    BUNNY.init(gl);
    TORUS.init(gl);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
    
    window.requestAnimationFrame(render);


    function resize_canvas(event)
    {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0,0,canvas.width, canvas.height);
        mProjection = ortho(-aspect, aspect, -1, 1, -5, 5);
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
                multRotationY(180 * b.reachGroundTime);
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
        multScale([2.5,2.5,2.5]);
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

    function WallSupport()
    {
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(0.3, 0.15, 0.0)); //Sides color
        pushMatrix();
            multTranslation([0.8,0.735,0.0]);
            multRotationZ(45);
            multScale([0.075,2.0,0.075]);
            uploadModelView();
            CUBE.draw(gl, program, mode);
        popMatrix();
    }

    function WallStake()
    {
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(.2, .2, .2));
        pushMatrix();
            multTranslation([0.0,1.25,0.0]);
            multScale([0.075,2.5,0.075]);
            uploadModelView();
            CUBE.draw(gl, program, mode);
        popMatrix();
    }

    function WallPart()
    {
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(.2, .2, .2));
        pushMatrix();
            multTranslation([0.0,1.0,0.0]);
            multScale([0.3,2.0,3.0]);
            uploadModelView();
            CUBE.draw(gl, program, mode);
        popMatrix();
    }

    function Wall()
    {
        pushMatrix();
            WallPart();
        popMatrix();
        pushMatrix();
            multTranslation([0.0,0.0,3.0]);
            WallPart();
            WallSupport();
        popMatrix();
        pushMatrix();
            multTranslation([0.0,0.0,-3.0]);
            WallPart();
            WallSupport();
        popMatrix();
        pushMatrix();
            multTranslation([0.0,0.0,6.0]);
            WallPart();
            WallStake();
            WallSupport();
        popMatrix();
        pushMatrix();
            multTranslation([0.0,0.0,-6.0]);
            WallPart();
            WallStake();
            WallSupport();
        popMatrix();
        pushMatrix();
            multTranslation([0.24,0.0,8.8]);
            multRotationY(10);
            WallPart();
            WallStake();
            WallSupport();
        popMatrix();
        pushMatrix();
            multTranslation([0.24,0.0,-8.8]);
            multRotationY(-10);
            WallPart();
            WallStake();
            WallSupport();
        popMatrix();
        pushMatrix();
            multTranslation([0.72,0.0,11.4]);
            multRotationY(10);
            WallPart();
            WallSupport();
        popMatrix();
        pushMatrix();
            multTranslation([0.72,0.0,-11.6]);
            multRotationY(-10);
            WallPart();
            WallSupport();
        popMatrix();
        pushMatrix();
            multTranslation([1.5,0.0,14.2]);
            multRotationY(20);
            pushMatrix();
                multTranslation([0.05,0.0,9.0])
                multScale([1.8,1.15,1.8]);
                WallStake();
                WallSupport();
                popMatrix();
            multScale([1.0,1.0,4.35]);
            multTranslation([0.0,0.0,1.13]);
            WallPart();
        popMatrix();
        pushMatrix();
            multTranslation([1.4,0.0,-14.2]);
            multRotationY(-20);
                pushMatrix();
                multTranslation([0.05,0.0,-9.0])
                multScale([1.8,1.15,1.8]);
                WallStake();
                WallSupport();
                popMatrix();
            multScale([1.0,1.0,4.35]);
            multTranslation([0.03,0.0,-1.15]);
            WallPart();
        popMatrix();
    }

    function Building()
    {
        pushMatrix();
            multTranslation([22.6,3.5,-22.6]);
            multScale([4.5, 7.0, 4.5]);
            uploadModelView();
            CUBE.draw(gl, program, mode);
        popMatrix();
    }
    function BuildingDestruction() {     
        pushMatrix();
            multScale([0.5, 2.0, 4.5]);
            uploadModelView();
            CUBE.draw(gl, program, mode);
        popMatrix();
    }

    function BuildingDestructed()
    {
    pushMatrix();
        multTranslation([23.6,8.0,-4.3]);
        multRotationY(-180);
        multScale([2.0,1.0,1.0]);
        BuildingDestruction();
    popMatrix();
    pushMatrix();
        multTranslation([22.6,4.2,-3.6]);
        multRotationX(45);
        multScale([1.0,1.5,0.2]);
        BuildingDestruction();
    popMatrix();
    pushMatrix();
        multTranslation([23.0,2.0,-18.6]);
        pushMatrix();
            multTranslation([-0.75,-2.2,3.1]);
            multRotationY(-75);
            multRotationX(-25);
            multRotationZ(45);
            Window();
        popMatrix();
        multRotationX(45);
        multRotationZ(-35);
        multScale([1.0,1.0,0.8]);
        BuildingDestruction();
    popMatrix();
    pushMatrix();
        multTranslation([22.6,4.2,-5.9]);
        multRotationX(-30);
        multScale([2.0,2.0,0.2]);
        BuildingDestruction();
    popMatrix();
    pushMatrix();
        multTranslation([22.4, 7.5,-1.34]);
        multScale([7.25, 4.0, 0.7]);
        BuildingDestruction();
    popMatrix();
    pushMatrix();
        multTranslation([15.5,15.5,-1.31]);
        multScale([0.3,0.15,0.3]);
        Building();
    popMatrix();
    pushMatrix();
        multTranslation([22.4,9.5,-8.1]);
        multScale([7.25, 6.0, 0.7]);
        BuildingDestruction();
    popMatrix();  
    pushMatrix();
        multTranslation([4.3,0.0,45.0]);
        multScale([0.8, 0.5, 2.2]);
        Building();  
    popMatrix();
    }
    
    function Buildings()
    {
    pushMatrix();
        pushMatrix();
            multTranslation([22.1,8.0,-24.6]);
            multRotationY(90);
            multScale([1.0,1.0,0.8]);
            BuildingDestruction();
        popMatrix();
        pushMatrix();
            multTranslation([24.35,8.0,-22.6]);
            multScale([2.0,1.0,1.0]);
            BuildingDestruction();
        popMatrix();
        Building();
    popMatrix(); 
    pushMatrix();
        multTranslation([2.5,0.0,69.5]);
        multScale([0.9, 1.2, 2.2]);
        Building();  
    popMatrix();
    }

    function AllBuildings()
    {
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(.1, .1, .1));
        
        pushMatrix();
            Buildings();
            multTranslation([-2.0,0.0,0.0]);
            BuildingDestructed();
        popMatrix();

        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(.4, .4, .4));

        AllWindows();
    }

    function WheelDetail()
    {
        pushMatrix();
            multTranslation([0.0,0.0,0.02]);
            multScale([0.5,0.5,1.0]);
            SmallWheels();
        popMatrix();
    }

    function SmallWheels()
    {
        pushMatrix();
            multTranslation([0.0,0.0,0.07]);
            multScale([0.15,0.15,0.1]);
            uploadModelView();
            SPHERE.draw(gl, program, mode);
        popMatrix();
        
    }

    function TankWheels()
    {
        pushMatrix();
            multScale([1.5,0.3,0.1]);
            uploadModelView();
            SPHERE.draw(gl, program, mode);
        popMatrix();
        pushMatrix();
            multTranslation([0.0,0.0,0.03])
            multScale([1.5,0.2,0.1]);
            uploadModelView();
            SPHERE.draw(gl, program, mode);
        popMatrix();
        pushMatrix();
            multScale([1.25,1.25,1.25]);
            SmallWheels();
            WheelDetail();
        popMatrix();
        pushMatrix();
            multTranslation([0.25,0.0,0.0]);
            SmallWheels();
            WheelDetail();
        popMatrix();
        pushMatrix();
            multTranslation([-0.25,0.0,0.0]);
            SmallWheels();
            WheelDetail();
        popMatrix();
        pushMatrix();
            multTranslation([-0.425,0.0,0.01]);
            multScale([0.75,0.75,0.75]);
            SmallWheels();
            WheelDetail();
        popMatrix();
        pushMatrix();
            multTranslation([0.425,0.0,0.01]);
            multScale([0.75,0.75,0.75]);
            SmallWheels();
            WheelDetail();
        popMatrix();

    }

    function TankCannon()
    {
        pushMatrix();
            multTranslation([1.0,0.1,0.0]);
            multRotationZ(-88);
            multScale([0.1,3.0,0.1]);
            uploadModelView();
            CYLINDER.draw(gl, program, mode);
            pushMatrix();
                multTranslation([0.0,0.5,0.0]);
                multScale([1.5,0.1,1.5]);
                uploadModelView();
                CYLINDER.draw(gl, program, mode); 
            popMatrix();
            pushMatrix();
                multTranslation([0.0,-0.15,0.0]);
                multScale([3.0,0.1,3.0]);
                uploadModelView();
                CYLINDER.draw(gl, program, mode); 
            popMatrix();
            pushMatrix();
                multTranslation([0.0,-0.05,0.0]);
                multScale([2.0,0.1,2.0]);
                uploadModelView();
                CYLINDER.draw(gl, program, mode); 
            popMatrix();
            pushMatrix();
                multTranslation([0.0,0.0,0.0]);
                multScale([1.5,0.1,1.5]);
                uploadModelView();
                CYLINDER.draw(gl, program, mode); 
            popMatrix();
        popMatrix();
    }

    function TankHatch()
    {

    }

    function TankBody()
    {
        pushMatrix();
            multTranslation([0.0,0.09,0.0]);
            multScale([1.5,0.15,1.5]);
            uploadModelView();
            CUBE.draw(gl, program, mode);
        popMatrix();
        //Init TankHead
        pushMatrix();
            pushMatrix();
                multScale([1.0,1.0,0.50]);
                multTranslation([0.0,0.3,0.0]);
                multScale([0.4,0.2,0.8]);
                uploadModelView();
                CUBE.draw(gl, program, mode);
                multTranslation([0.0,0.1,0.0]);
                TankCannon();
                multTranslation([-0.75,0.5,0.2]);
                pushMatrix();
                    multTranslation([0.0,0.1,0.0]);
                    multRotationZ(65);
                    multScale([0.02,0.75,0.04]);
                    uploadModelView();
                    CYLINDER.draw(gl, program, mode);
                popMatrix();
                pushMatrix();
                    multTranslation([0.33,-0.12,0.0]);
                    multScale([0.1,0.3,0.1]);
                    uploadModelView();
                    SPHERE.draw(gl, program, mode);
                popMatrix();
                pushMatrix();
                    multTranslation([0.75,0.2,0.0]);
                    multRotationX(90);
                    multScale([0.3,0.3,0.3]);
                    uploadModelView();
                    SPHERE.draw(gl, program, mode);
                    multTranslation([0.0,-1.3,0.0]);
                    uploadModelView();
                    SPHERE.draw(gl, program, mode);
                popMatrix();
            popMatrix();
                multTranslation([0.0,0.4,0.0]);
                multScale([0.2,0.2,0.4]);
                multRotationY(120 * time);
                uploadModelView();
                SPHERE.draw(gl, program, mode);
                multTranslation([0.0,0.2,0.0]);
                multScale([0.5,0.5,0.5]);
                TankCannon();
        popMatrix();
        //End TankHead
        pushMatrix();
            multTranslation([0.0,0.24,0.0]);
            multScale([1.5,0.15,1.5]);
            uploadModelView();
            PYRAMID.draw(gl, program, mode);
        popMatrix();
    }

    function Tank() {
        multTranslation([0.0,0.1,0.0]);
        multScale([2.0,2.0,2.0]);
        pushMatrix();
            multTranslation([0.0,0.0,0.4]);
            TankWheels();
        popMatrix();
        pushMatrix();
            multTranslation([0.0,0.0,-0.4]);
            multRotationY(180);
            TankWheels();
        popMatrix();
        pushMatrix();
            multTranslation([0.0,-0.05,0.0]);
            multScale([0.98,1.0,0.5]);
            TankBody();
        popMatrix();
    }

    function Tanks() 
    {
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(.4, .4, .4));

        pushMatrix();
            multTranslation([0.0,0.15,0.0]);
            Tank();
        popMatrix();

        pushMatrix();
            multTranslation([-5.0,0.15,10.0]);
            multRotationY(10);
            Tank();
        popMatrix();

        pushMatrix();
            multTranslation([-5.0,0.15,-10.0]);
            multRotationY(-10);
            Tank();
        popMatrix();

        pushMatrix();
            multTranslation([-10.0,0.15,20.0]);
            multRotationY(20);
            Tank();
        popMatrix();

        pushMatrix();
            multTranslation([-10.0,0.15,-20.0]);
            multRotationY(-20);
            Tank();
        popMatrix();
    }

    function Window() 
    {
        pushMatrix();
            multTranslation([0.0,3.5,0.0]);
            multScale([1.5, 1.5, .04]);
            uploadModelView();
            CUBE.draw(gl, program, mode);
        popMatrix();
        pushMatrix();
            multTranslation([0.0,4.25,0.1]);
            multScale([1.5, 0.2, 0.25]);
            uploadModelView();
            CUBE.draw(gl, program, mode);
        popMatrix();
        pushMatrix();
            multTranslation([0.0,2.75,0.1]);
            multScale([1.5, 0.2, 0.25]);
            uploadModelView();
            CUBE.draw(gl, program, mode);
        popMatrix();
        pushMatrix();
            multTranslation([0.8,3.5,0.1]);
            multRotationZ(-90);
            multScale([1.7, 0.2, 0.25]);
            uploadModelView();
            CUBE.draw(gl, program, mode);
        popMatrix();  
        pushMatrix();
            multTranslation([-0.8,3.5,0.1]);
            multRotationZ(-90);
            multScale([1.7, 0.2, 0.25]);
            uploadModelView();
            CUBE.draw(gl, program, mode);
        popMatrix();                      
    }

    function AllWindows() {
        pushMatrix();
            multTranslation([20.5,4.5,0.22]);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([20.5,0.5,0.22]);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([18.55,4.5,-1.32]);
            multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([18.55,0.5,-1.32]);
            multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([18.55,0.5,-8.1]);
            multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([18.55,-1.9,-3.5]);
            multRotationX(-15);
            multRotationY(-65);
            multRotationZ(15);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([18.55,8.5,-8.1]);
            multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([18.55,4.5,-8.1]);
            multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([20.5,8.5,-6.5]);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([22.5,1.8,-20.35]);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([22.5,-1.5,-20.35]);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([20.3,-1.5,-22.7]);
            multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([20.3,1.8,-22.7]);
            multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([23.0,3.0,24.75]);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([23.0,-0.8,24.75]);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([20.8,3.0,22.0]);
            multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([20.8,3.0,18.0]);
             multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([20.8,-0.8,22.0]);
            multRotationY(-90);
            Window();
        popMatrix();
        pushMatrix();
            multTranslation([20.8,-0.8,18.0]);
            multRotationY(-90);
            Window();
        popMatrix();


    }

    function World()
    {
        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(1, 0.0, 1.0)); //Helicopter color

        Helicopter();

        pushMatrix();
            multTranslation([0.0,-0.4,0.0]);
            DropBox();
        popMatrix();

        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(.2, .2, .2));

        pushMatrix();
            multTranslation([6.0,0.0,0.0]);
            WallStake();
            Wall();
        popMatrix();

        AllBuildings();

        Tanks();

        /*pushMatrix();
            multTranslation([0.0, 0.5, 0.0]);
            uploadModelView();
            CUBE.draw(gl, program, mode);
        popMatrix();
        */

        gl.uniform3fv(gl.getUniformLocation(program, "uColor"), vec3(0.3, 0.3, 0.3)); //Ground color

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