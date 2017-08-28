/*---------------copyright by Neil, You, Shanghai Jiaotong University 2016, 5 ------------------*/

/* known issue: Absolute position can only be calculated with a single canvas layer depth.
*               Mouse callback may prevent collision detection from working. */

var BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

var ObjPool = {
    objects : [],
    Create : function() {
        var obj = {
            Destroy : function() {
                var index = ObjPool.objects.indexOf(this);
                ObjPool.objects.splice(index, 1);
            },
            absPos : function() {
                var absX = 0, absY = 0;

                if (this.hasOwnProperty("shape")) {
                    absX = this.shape.x;
                    absY = this.shape.y;
                } else {
                    absX = this.x;
                    absY = this.y;
                }
                var that = this;
                if (that.hasOwnProperty("parent")) {
                    var parent = that.parent;
                    absX += parent.x;
                    absY += parent.y;
                    /* that = that.parent; */
                }
                return {x:absX, y:absY};
            },
            __internal : {
                collidedObjects : []
            }
        };
        this.objects.push(obj);
        obj.rigid = false;
        return obj;
    }
};

var Mouse = {
    target : null,
    Attach : function(obj) {
        this.target = obj;
    },
    Detach : function() {
        this.target = null;
    }
};

var PIdiv4 = 1.0 / 4.0 * Math.PI;
var EventManager = {
    currentMousePosition : {
        x : 0,
        y : 0
    },
    MouseUp : function(e) {
        if (Global.MOUSE_BLOCKED) return;
        var objs = ObjPool.objects.concat();
        for (var i = 0; i < objs.length; ++i) {
            var obj = objs[i];
            if (obj.hasOwnProperty("onClicked")) {
                if (this.currentMousePosition.x > (obj.absPos()).x && this.currentMousePosition.x < (obj.absPos()).x + obj.shape.width
                    && this.currentMousePosition.y > (obj.absPos()).y && this.currentMousePosition.y < (obj.absPos()).y + obj.shape.height)
                    obj.onClicked();
            }
        }
    },
    MouseMove : function(e) {
        if (Global.MOUSE_BLOCKED) return;
        this.currentMousePosition.x = e.localX;
        this.currentMousePosition.y = e.localY;
        if (Mouse.target != null) {
            Mouse.target.shape.x = e.localX - Mouse.target.shape.width / 2;
            Mouse.target.shape.y = e.localY - Mouse.target.shape.height / 2;
        }
        for (var i = 0; i < ObjPool.objects.length; ++i) {
            var obj = ObjPool.objects[i];

            if (this.currentMousePosition.x > (obj.absPos()).x && this.currentMousePosition.x < (obj.absPos()).x + obj.shape.width
                && this.currentMousePosition.y > (obj.absPos()).y && this.currentMousePosition.y < (obj.absPos()).y + obj.shape.height) {

                if((obj.__internal.catchMouse == null) || (obj.__internal.catchMouse == false)) {
                    obj.__internal.catchMouse = true;
                    if (obj.hasOwnProperty("onEntered")) {
                        obj.onEntered();
                    }
                }
            } else {
                if(obj.__internal.catchMouse == true) {
                    obj.__internal.catchMouse = false;
                    if (obj.hasOwnProperty("onLeaved")) {
                        obj.onLeaved();
                    }
                }
            }
        }
    },
    EnterFrame : function () {

        for (var i = 0; i < ObjPool.objects.length; ++i) {
            var obj = ObjPool.objects[i];
            if (obj.hasOwnProperty("onFrame")) {
                obj.onFrame();
            }
            if (obj.rigid && obj.hasOwnProperty("onCollision")) {
                var speed = {x:0, y:0};
                if (obj.__internal.lastPosition == null) {
                    obj.__internal.lastPosition = {
                        x : (obj.absPos()).x,
                        y : (obj.absPos()).y
                    };
                } else {
                    /*compute speed direction*/
                    speed.x = (obj.absPos()).x - obj.__internal.lastPosition.x;
                    speed.y = (obj.absPos()).y - obj.__internal.lastPosition.y;

                    obj.__internal.lastPosition.x = (obj.absPos()).x;
                    obj.__internal.lastPosition.y = (obj.absPos()).y;
                }



                for (var j = 0; j < ObjPool.objects.length; ++j) {
                    /*TODO(Neil): check pixel collision*/
                    var anotherObj = ObjPool.objects[j];
                    if (!anotherObj.rigid) continue;
                    if (anotherObj == obj) continue;

                    /*first one*/
                    var x1min = (obj.absPos()).x;
                    var x1max = (obj.absPos()).x + obj.shape.width;
                    var y1min = (obj.absPos()).y;
                    var y1max = (obj.absPos()).y + obj.shape.height;

                    /*second one*/
                    var x2min = (anotherObj.absPos()).x;
                    var x2max = (anotherObj.absPos()).x + anotherObj.shape.width - 1;
                    var y2min = (anotherObj.absPos()).y;
                    var y2max = (anotherObj.absPos()).y + anotherObj.shape.height - 1;

                    /*check*/
                    if (x1max > x2min && x1min < x2max && y1max > y2min && y1min < y2max) {
                        /*collided*/
                        if (obj.__internal.collidedObjects.indexOf(anotherObj) != -1) {
                            /*already in*/
                            continue;
                        }
                        obj.__internal.collidedObjects.push(anotherObj);

                        /*compute orientation*/
                        var direction;
                        var angle = Math.atan2(speed.y, speed.x);
                        if (angle <= 3 * PIdiv4 && angle > PIdiv4 ) {
                            direction = "DOWN";
                        } else if (angle <= PIdiv4 && angle > -PIdiv4) {
                            direction = "RIGHT";
                        } else if (angle <= -PIdiv4 && angle > -3 * PIdiv4) {
                            direction = "UP";
                        } else {
                            direction = "LEFT";
                        }
                        obj.onCollision(anotherObj, direction);
                    } else {
                        /*lost*/
                        var index = obj.__internal.collidedObjects.indexOf(anotherObj);
                        if (index != -1) {
                            /*already in*/
                            obj.__internal.collidedObjects.splice(index, 1);
                        }
                    }
                }
            }
        }
    }
};

/***********************************************************************/
function resetObject(object, param) {
    ScriptManager.popEl(object);
    if (param && param.parent) param.parent.addChild(object);
    else $.root.addChild(object);
    object.transform.matrix3D = null;
    return object;
}
/***********************************************************************/
function setParameters(object, param) {
    foreach(param,
        function(key, val) {
            if (object.hasOwnProperty(key)) object['' + key] = val;
        });
}
/***********************************************************************/
function eraseParameters(param, filter) {
    var newParam = {};
    foreach(param,
        function(key, val) {
            if (!filter.hasOwnProperty(key)) newParam['' + key] = val;
        });
    return newParam;
}


function createCanvas(param) {
    var object = resetObject($.createCanvas({
        lifeTime: 0
    }), param);
    setParameters(object, eraseParameters(param, {
        parent: 0
    }));
    return object;
}

function createText(str, param) {
    var object = resetObject($.createComment(str, {
        lifeTime: 0
    }), param);
    object.defaultTextFormat = $.createTextFormat('微软雅黑', (param && param.size) || 14, (param && param.color != null) ? param.color: 0xFFFFFF, false, false, false);
    object.filters = [];
    object.text = str;
    setParameters(object, eraseParameters(param, {
        parent: 0,
        size: 0,
        color: 0
    }));
    return object;
}

function fillRect(g, x, y, width, height, color) {
    g.graphics.beginFill(color);
    g.graphics.drawRect(x, y, width, height);
    g.graphics.endFill();
}

function abgr2rgba(data) {
    for (var i = 0; i < data.length / 2; i += 1) {
        var temp = data[i];
        data[i] = data[data.length - 1 - i];
        data[data.length - 1 - i] = temp;
    }
    return data;
}

function extract(data) {
    var bmd = Bitmap.createBitmapData(1, 1);
    var output = bmd.getPixels(bmd.rect);
    output.clear();
    var dataBuffer = [];
    dataBuffer.length = 4;
    var outputBuffer = [];
    outputBuffer.length = 3;
    var cnt = 0;
    for (var i = 0; i < data.length; i += 4) {
        for (var j = 0; j < 4 && i + j < data.length; j++) {
            dataBuffer[j] = BASE64_CHARS.indexOf(data.charAt(i + j));
        }

        /* attention, bgr to rgb convertion! */
        outputBuffer[0] = (dataBuffer[0] << 2) + ((dataBuffer[1] & 0x30) >> 4);
        outputBuffer[1] = ((dataBuffer[1] & 0x0f) << 4) + ((dataBuffer[2] & 0x3c) >> 2);
        outputBuffer[2] = ((dataBuffer[2] & 0x03) << 6) + dataBuffer[3];
        for (var k = 0; k < outputBuffer.length; k++) {
            if (dataBuffer[k + 1] == 64) break;
            if (cnt >= 54) { /* skip bmp header */
                /*if (cnt % 3 == 1) {
                    output.writeByte(0);
                };*/

                output.writeByte(outputBuffer[k]);
            }
            cnt++;
        }
    }
    output = abgr2rgba(output);
    output.position = 0;
    return output;
}

function loadBitmapData(width, height, raw) {
    var bmd = Bitmap.createBitmapData(width, height);
    /* trace((extract(raw)).length); */
    bmd.setPixels(bmd.rect, extract(raw));
    return bmd;
}

function createBitmap(bitmapData, lifeTime, scale, parent) {
    var bmp = Bitmap.createBitmap({
        bitmapData: bitmapData,
        lifeTime: lifeTime,
        parent: parent,
        scale: scale
    });
    return bmp;
}

function createBMPObj(width, height, type, lifetime, scale, parent) {
    var obj = ObjPool.Create();
    var raw = Global.RESOURCES.BITMAPS[type];
    var bmd;
    if (Global.CACHE.BMD.hasOwnProperty(raw)) {
        bmd = Global.CACHE.BMD[raw];
    } else {
        bmd = loadBitmapData(width, height, raw);
        Global.CACHE.BMD[raw] = bmd;
    }
    obj.shape = createBitmap(bmd, lifetime, scale, parent);
    obj.type = type;
    obj.parent = parent;
    return obj;
}
/***********************************************************************/
/***********************************************************************/
/***********************************************************************/


var Global = {
    PLAYER : {},
    MAP: [],
    MAP_SIZE: {
      x : 13,
      y : 13
    },
    BLOCK_TYPE: {
        CNT : 1 << 8,
        KEY : {
            RED : 4,
            BLUE : 5,
            YELLOW : 6
        },
        PLAYER : 1,
        SLM_GREEN : 3,
        EMPTY : 0
    },
    BLOCK_SIZE: {
        x : 0,
        y : 0
    },
    DATA : {
        PLAYER : {
            HP : 999999,
            ATK : 10,
            DEF : 10,
            GOLD : 0,
            EXP : 0
        },
        SLM_GREEN : {
            HP : 50,
            ATK : 10,
            DEF : 0,
            GOLD : 2,
            EXP : 1,
            SPECIAL : {}
        }
    },
    MAP_SCALE: 0,
    RESOURCES : {
        BITMAPS : {
            WARRIOR_BLUE: "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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIkV3/yJFd/9FZpf/IUV1/0Nlmv8hRXX/Q2eX/yFFdf8hRXX/IUV1/0Vml/8hRXX/IEN1/yJFd/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIEN1/yFFdf9FZpf/RWaX/0Nlmv9FZpf/Q2Wa/yJEef9FZpf/IkV3/0Vml/8iRXf/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAiRXf/IkV3/0Vml/9DZZr/Q2Wa/0Nlmv8hRXX/Q2Wa/yJDdf9DZZr/IkV3/yFFdf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAiRXf/IkN1/yJDdf9FZpf/IEN1/0Vml/8iQ3X/IkV3/yJFd/8iRXf/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIkV3/yJFd/8iRXf/IkV3/yJFd/8iRXf/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            BACKGROUND: "Qk02EAAAAAAAADYAAAAoAAAAIAAAAOD///8BACAAAAAAAAAQAAATCwAAEwsAAAAAAAAAAAAAQURB/0lISf9BREH/amxq/0FEQf9qaGr/QURB/2psav9BREH/SUhJ/0lISf9qaGr/QURB/0lISf9JSEn/SUhJ/0lISf9JSEn/QURB/2poav9qaGr/YmRi/0lISf9JSEn/SUhJ/0FEQf9qbGr/YmRi/0lISf9JSEn/QURB/0lISf9qbGr/QURB/2psav9BREH/amhq/0FEQf9qbGr/YmRi/2poav9BREH/QURB/0FEQf9qaGr/QURB/2JkYv9BREH/SUhJ/2JkYv9JSEn/QURB/2poav9BREH/SUhJ/2JkYv9BREH/amxq/0FAQf9qaGr/QURB/2JkYv9qbGr/YmRi/0lISf9JSEn/QURB/2psav9JSEn/amhq/2poav9JSEn/SUhJ/0FEQf9JSEn/amhq/0lISf9qaGr/amxq/2poav9qaGr/amhq/2poav9JSEn/SUhJ/0lESf9qbGr/QURB/2poav9BREH/amxq/2poav9qaGr/SUhJ/2poav9JSEn/amxq/0FEQf9qaGr/QURB/2psav9BREH/SUhJ/0FEQf9qbGr/QUhB/0FIQf9BREH/amxq/0FEQf9JSEn/QURB/0FEQf9JSEn/QURB/0lISf9BREH/QURB/0FEQf9qaGr/SUhJ/2poav9qaGr/amhq/2JkYv9qaGr/SUhJ/2poav9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/w==",
            SLM_GREEN : "Qk02EAAAAAAAADYAAAAoAAAAIAAAAOD///8BACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqzKr/qsyq/6rMqv+qzKr/qsyq/6rMqv+qzKr/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKrMqv+qzKr/qsyq/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/6rMqv+qzKr/qsyq/6rMqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqzKr/qsyq/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/6rMqv/M7sz/qsyq/6rMqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAqsyq/6rMqv/M7sz/zO7M/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/6rMqv/M7sz/qsyq/6rMqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqzKr/zO7M/8zuzP/MzMz/zMzM/8zMzP/M7sz/zO7M/8zuzP/M7sz/zO7M/8zMzP/MzMz/zMzM/6rMqv/M7sz/qsyq/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAqsyq/6rMqv/M7sz/zMzM/////////////////8zMzP/M7sz/zO7M/8zuzP/MzMz/////////////////zMzM/6rMqv+qzKr/qsyq/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqzKr/zO7M/8zMzP///////////0RERP9ERET//////8zMzP/M7sz/zMzM//////9ERET/RERE////////////zMzM/6rMqv+qzKr/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKrMqv/M7sz/zMzM////////////RERE/8zMzP//////zMzM/8zuzP/MzMz//////8zMzP9ERET////////////MzMz/zO7M/6rMqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAqsyq/8zuzP/MzMz///////////9ERET/RERE///////MzMz/zO7M/8zMzP//////RERE/0RERP///////////8zMzP+qzKr/qsyq/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqzKr/qsyq/8zuzP/MzMz/////////////////zMzM/8zuzP/M7sz/zO7M/8zMzP/////////////////MzMz/qsyq/6rMqv+qzKr/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqzKr/zO7M/8zuzP/MzMz/zMzM/8zMzP/M7sz/zO7M/8zuzP/M7sz/zO7M/8zMzP/MzMz/zMzM/6rMqv/M7sz/qsyq/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKrMqv+qzKr/zO7M/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/8zuzP+qzKr/zO7M/6rMqv+qzKr/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKrMqv+qzKr/zO7M/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/6rMqv/M7sz/qsyq/8zuzP+qzKr/qsyq/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKrMqv+qzKr/qsyq/8zuzP/M7sz/qsyq/8zuzP+qzKr/zO7M/6rMqv+qzKr/qsyq/6rMqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAqsyq/6rMqv+qzKr/qsyq/6rMqv+qzKr/qsyq/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="
        }
    },
    CANVAS : {
        EMPTY_CANVAS : {},
        MAP_CANVAS : {},
        GUI_CANVAS : {},
        BACK_CANVAS : {},
        LEFT_STATUS_CANVAS : {},
        RIGHT_STATUS_CANVAS : {}
    },
    CACHE : {
        BMD : {}
    },
    KEY_BLOCKED : false,
    MOUSE_BLOCKED : false
};

function initMap() {
    Global.MAP.length = Global.MAP_SIZE.x;

    for (var i = 0; i < Global.MAP.length; i++) {
        Global.MAP[i] = [];
        Global.MAP[i].length = Global.MAP_SIZE.y;
    }

    for (var i = 0; i < Global.MAP_SIZE.x; i++) {
        for (var j = 0; j < Global.MAP_SIZE.y; j++) {
            Global.MAP[i][j]= {};
            Global.MAP[i][j].objects = [];
            var obj =  createBMPObj(32, 32, "BACKGROUND", 0, Global.MAP_SCALE, Global.CANVAS.MAP_CANVAS);

            Global.MAP[i][j].type = Global.BLOCK_TYPE.EMPTY;
            obj.shape.x = i * Global.BLOCK_SIZE.x;
            obj.shape.y = j * Global.BLOCK_SIZE.y;
            obj.x = i;
            obj.y = j;
            obj.onClicked = function() {

                var xx = this.x;
                var yy = this.y;

                if (Mouse.target == null) {
                    trace("NULL");
                }
                if (Mouse.target != null && Global.MAP[xx][yy].objects.length <= 1) {
                    (placeObj(Mouse.target.type, xx, yy)).rigid = true;
                } else if (Global.MAP[xx][yy].objects.length > 1) {
                    removeObj(Global.MAP[xx][yy].objects[Global.MAP[xx][yy].objects.length - 1]);
                }
            };
            obj.onEntered = function() {
                var g = $.createShape({lifeTime:0,x:(this.absPos()).x,y:(this.absPos()).y});
                g.graphics.moveTo(0, 0);
                g.graphics.lineStyle(2, 0xFF4040, 1, false);
                g.graphics.lineTo(Global.BLOCK_SIZE.x, 0);
                g.graphics.lineTo(Global.BLOCK_SIZE.x, Global.BLOCK_SIZE.y);
                g.graphics.lineTo(0, Global.BLOCK_SIZE.y);
                g.graphics.lineTo(0, 0);
                this.g = g;
            };
            obj.onLeaved = function() {
                this.g.graphics.clear();
                this.g = {};
            };
            Global.MAP[i][j].objects.push(obj);
        }
    }
}

function initPlayer() {
    Global.PLAYER = createBMPObj(32, 32, "WARRIOR_BLUE", 0, Global.MAP_SCALE, Global.CANVAS.MAP_CANVAS);
    Global.PLAYER.shape.x = Global.BLOCK_SIZE.x * 5;
    Global.PLAYER.shape.y = Global.BLOCK_SIZE.y * 5;
    Global.PLAYER.x = 5;
    Global.PLAYER.y = 5;
    Global.PLAYER.status = clone(Global.DATA.PLAYER);
    Global.MAP[5][5].objects.push(Global.PLAYER);
    Global.MAP[5][5].type = Global.BLOCK_TYPE.PLAYER;

    Global.PLAYER.moveUp = function () {
        if (this.y > 0) {
            this.y -= 1;
            this.shape.y = Global.BLOCK_SIZE.y * this.y;
            Global.MAP[x][y+1].type = Global.BLOCK_TYPE.EMPTY;
            Global.MAP[x][y].type = Global.BLOCK_TYPE.PLAYER;
        }
    };

    Global.PLAYER.moveDown = function () {
        if (this.y < Global.MAP_SIZE.y - 1) {
            this.y += 1;
            this.shape.y = Global.BLOCK_SIZE.y * this.y;
            Global.MAP[x][y-1].type = Global.BLOCK_TYPE.EMPTY;
            Global.MAP[x][y].type = Global.BLOCK_TYPE.PLAYER;
        }
    };

    Global.PLAYER.moveLeft = function () {
        if (this.x > 0) {
            this.x -= 1;
            this.shape.x = Global.BLOCK_SIZE.x * this.x;
            Global.MAP[x+1][y].type = Global.BLOCK_TYPE.EMPTY;
            Global.MAP[x][y].type = Global.BLOCK_TYPE.PLAYER;
        }
    };

    Global.PLAYER.moveRight = function () {
        if (this.x < Global.MAP_SIZE.x - 1) {
            this.x += 1;
            this.shape.x = Global.BLOCK_SIZE.x * this.x;
            Global.MAP[x-1][y].type = Global.BLOCK_TYPE.EMPTY;
            Global.MAP[x][y].type = Global.BLOCK_TYPE.PLAYER;
        }
    };

    Global.PLAYER.rigid = true;
    Global.PLAYER.onCollision = function (obj, dir) {
        enterBattle(this, obj, true);
        /*trace(dir);*/
    };
    Global.PLAYER.onBattleWin = function (obj) {
        trace("you win!");
        removeObj(obj);
    };
}

function placeObj(type, x, y) {
    var obj = createBMPObj(32, 32, type, 0, Global.MAP_SCALE, Global.CANVAS.MAP_CANVAS);
    obj.shape.x = Global.BLOCK_SIZE.x * x;
    obj.shape.y = Global.BLOCK_SIZE.y * y;
    obj.x = x;
    obj.y = y;
    obj.status = clone(Global.DATA[type]);
    Global.MAP[x][y].objects.push(obj);

    Global.MAP[x][y].type = Global.BLOCK_TYPE[type];
    return obj;
}

function removeObj(obj) {
    var x = parseInt(obj.x);
    var y = parseInt(obj.y);
    obj.shape.alpha = 0;
    Global.MAP[x][y].type = Global.BLOCK_TYPE.EMPTY;
    var index = Global.MAP[x][y].objects.indexOf(obj);
    Global.MAP[x][y].objects.splice(index, 1);
    obj.Destroy();
}

function keyDown(key) {
    if (Global.KEY_BLOCKED) return;
    if (Global.PLAYER != {}) {
        if (key == 87 || key == 38) {
            Global.PLAYER.moveUp();
        } else if (key == 83 || key == 40) {
            Global.PLAYER.moveDown();
        } else if (key == 65 || key == 37) {
            Global.PLAYER.moveLeft();
        } else if (key == 68 || key == 39) {
            Global.PLAYER.moveRight();
        }
    }
}

function initListener() {
    /* $.frameRate = 30; */
    $.root.mouseEnabled = true;

    $.root.addEventListener("enterFrame", function () {
        EventManager.EnterFrame();
    });

    $.root.addEventListener("mouseMove", function (e) {
        EventManager.MouseMove(e);
    });
    $.root.addEventListener("mouseUp", function (e) {
        EventManager.MouseUp(e);
    });
}

function init() {

    ScriptManager.clearTimer();
    ScriptManager.clearEl();
    ScriptManager.clearTrigger();

    Player.keyTrigger(function(key){
        keyDown(key);
    }, 1<<31 -1);



    /*Global.CACHE.BMD.length = Global.BLOCK_TYPE.CNT;*/
    Global.BLOCK_SIZE.x = Global.BLOCK_SIZE.y = Math.floor(Math.min(Player.width / Global.MAP_SIZE.x, Player.height / Global.MAP_SIZE.y));
    Global.MAP_SCALE = Global.BLOCK_SIZE.x / 32;


    /*Global.CANVAS.EMPTY_CANVAS = createCanvas({
       x: 0,
       y: 0,
       lifeTime: 0
    });
    Player.keyTrigger(function(key){
       keyUp(key);
    },INT_MAX,true);*/

}

function editInit() {


    Global.CANVAS.MAP_CANVAS = createCanvas({
        x: Player.width/2 - Global.MAP_SIZE.x/2 * Global.BLOCK_SIZE.x,
        y: Player.height/2 - Global.MAP_SIZE.y/2 * Global.BLOCK_SIZE.y,
        lifeTime: 0
    });

    Global.CANVAS.GUI_CANVAS = createCanvas({
        x: Player.width/2 + Global.MAP_SIZE.x/2 * Global.BLOCK_SIZE.x,
        y: Player.height/2 - Global.MAP_SIZE.y/2 * Global.BLOCK_SIZE.y,
        lifeTime: 0
    });

    var bmp = createBMPObj(32, 32, "SLM_GREEN", 0, Global.MAP_SCALE, Global.CANVAS.GUI_CANVAS);
    bmp.onClicked = function() {
        if (Mouse.target != null && Mouse.target.type == this.type) {
            /*ScriptManager.popEl(Mouse.target);*/
            Mouse.target.shape.alpha = 0;
            Mouse.Detach();
        } else {
            var a = createBMPObj(32, 32, this.type, 0, Global.MAP_SCALE, 0);
            a.shape.x = (this.absPos()).x;
            a.shape.y = (this.absPos()).y;
            a.shape.alpha = 0.5;
            Mouse.Attach(a);
        }
    };

    $.createButton({
        x:0,
        y:300,
        parent:Global.CANVAS.GUI_CANVAS,
        text:"编辑",
        onclick:function(){
            Global.KEY_BLOCKED = true;
            Global.MOUSE_BLOCKED = false;
        },
        lifeTime: 0
    });
    $.createButton({
        x:0,
        y:400,
        parent:Global.CANVAS.GUI_CANVAS,
        text:"测试",
        onclick:function(){
            Global.KEY_BLOCKED = false;
            Global.MOUSE_BLOCKED = true;
        },
        lifeTime: 0
    });
}

function battleFrame(player, monster, turn) {
    if (!turn) {
        player.status.HP -= monster.status.ATK;
        /*trace(player.status.HP);*/
        (Global.CANVAS.LEFT_STATUS_CANVAS.getChildByName("hp")).text = player.status.HP;
    } else {
        monster.status.HP -= player.status.ATK;
        /*trace(monster.status.HP);*/
        (Global.CANVAS.RIGHT_STATUS_CANVAS.getChildByName("hp")).text = monster.status.HP;
    }

    turn = !turn;
    if (player.status.HP <= 0) {
        Global.KEY_BLOCKED = false;
        if (player.hasOwnProperty("onBattleLose")) {
            player.onBattleLose(monster);
        }
        if (monster.hasOwnProperty("onBattleWin")) {
            monster.onBattleWin(player);
        }
    } else if (monster.status.HP <= 0) {
        Global.KEY_BLOCKED = false;
        if (player.hasOwnProperty("onBattleWin")) {
            player.onBattleWin(monster);
        }
        if (monster.hasOwnProperty("onBattleLose")) {
            monster.onBattleLose(player);
        }
    } else {
        timer(function() {
            battleFrame(player, monster, turn);
        }, 200);
    }
}

function enterBattle(player, monster, active) {
    /*reset monster GUI*/
    (Global.CANVAS.RIGHT_STATUS_CANVAS.getChildByName("hp")).text = monster.status.HP + "";
    (Global.CANVAS.RIGHT_STATUS_CANVAS.getChildByName("atk")).text = monster.status.ATK + "";
    (Global.CANVAS.RIGHT_STATUS_CANVAS.getChildByName("def")).text = monster.status.DEF + "";

    Global.KEY_BLOCKED = true;
    timer(function() {
        battleFrame(player, monster, active);
    }, 300);
}

function GUIInit() {
    createText("勇士信息", {x : 30, y : 60, parent : Global.CANVAS.LEFT_STATUS_CANVAS});
    createText("生命", {x : 30, y : 100, parent : Global.CANVAS.LEFT_STATUS_CANVAS});
    createText("攻击", {x : 30, y : 140, parent : Global.CANVAS.LEFT_STATUS_CANVAS});
    createText("防御", {x : 30, y : 180, parent : Global.CANVAS.LEFT_STATUS_CANVAS});
    (createText(Global.PLAYER.status.HP + "", {x : 80, y : 100, parent : Global.CANVAS.LEFT_STATUS_CANVAS})).name = "hp";
    (createText(Global.PLAYER.status.ATK + "", {x : 80, y : 140, parent : Global.CANVAS.LEFT_STATUS_CANVAS})).name = "atk";
    (createText(Global.PLAYER.status.DEF + "", {x : 80, y : 180, parent : Global.CANVAS.LEFT_STATUS_CANVAS})).name = "def";


    createText("怪物信息", {x : 30, y : 60, parent : Global.CANVAS.RIGHT_STATUS_CANVAS});
    createText("生命", {x : 30, y : 100, parent : Global.CANVAS.RIGHT_STATUS_CANVAS});
    createText("攻击", {x : 30, y : 140, parent : Global.CANVAS.RIGHT_STATUS_CANVAS});
    createText("防御", {x : 30, y : 180, parent : Global.CANVAS.RIGHT_STATUS_CANVAS});
    (createText("0", {x : 80, y : 100, parent : Global.CANVAS.RIGHT_STATUS_CANVAS})).name = "hp";
    (createText("0", {x : 80, y : 140, parent : Global.CANVAS.RIGHT_STATUS_CANVAS})).name = "atk";
    (createText("0", {x : 80, y : 180, parent : Global.CANVAS.RIGHT_STATUS_CANVAS})).name = "def";
}

function gameInit() {
    Global.CANVAS.MAP_CANVAS = createCanvas({
        x: Player.width/2 - Global.MAP_SIZE.x/2 * Global.BLOCK_SIZE.x,
        y: Player.height/2 - Global.MAP_SIZE.y/2 * Global.BLOCK_SIZE.y,
        lifeTime: 0
    });

    Global.CANVAS.LEFT_STATUS_CANVAS = createCanvas({
        x: 0,
        y: 0,
        lifeTime: 0
    });

    Global.CANVAS.RIGHT_STATUS_CANVAS = createCanvas({
        x: Player.width/2 + Global.MAP_SIZE.x/2 * Global.BLOCK_SIZE.x,
        y: 0,
        lifeTime: 0
    });

    initMap();
    initPlayer();


    /*var m = createBMPObj(32, 32, "SLM_GREEN", 0, Global.MAP_SCALE, Global.CANVAS.MAP_CANVAS);
    m.shape.x = Global.BLOCK_SIZE.x * 6;
    m.shape.y = Global.BLOCK_SIZE.y * 6;
    m.x = 6;
    m.y = 6;
    m.status = Global.DATA.SLM_GREEN;
    m.rigid = true;*/

    Global.KEY_BLOCKED = false;
    Global.MOUSE_BLOCKED = false;
}

init();
editInit();
gameInit();
GUIInit();
timer(function() {
    initListener();
}, 500);
