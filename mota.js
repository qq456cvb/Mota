/*---------------copyright by Neil, You, Shanghai Jiaotong University 2016, 5 ------------------*/

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
                    //that = that.parent;
                }
                return {x:absX, y:absY};
            },
            __internal : {}
        };
        this.objects.push(obj);
        return obj;
    }
};

var Mouse = {
    target : {},
    Attach : function(obj) {
        this.target = obj;
    },
    Detach : function() {
        this.target = {};
    }
};

var EventManager = {
    currentMousePosition : {
        x : 0,
        y : 0
    },
    MouseUp : function(e) {
        for (i = 0; i < ObjPool.objects.length; ++i) {
            var obj = ObjPool.objects[i];
            if (obj.hasOwnProperty("onClicked")) {
                if (this.currentMousePosition.x > (obj.absPos()).x && this.currentMousePosition.x < (obj.absPos()).x + obj.shape.width
                    && this.currentMousePosition.y > (obj.absPos()).y && this.currentMousePosition.y < (obj.absPos()).y + obj.shape.height)
                    obj.onClicked();
            }
        }
    },
    MouseMove : function(e) {
        this.currentMousePosition.x = e.localX;
        this.currentMousePosition.y = e.localY;
        for (i = 0; i < ObjPool.objects.length; ++i) {
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

function argb2rgba(data) {
    var batch = [];
    batch.length = 4;
    for (var i = 0; i < data.length; i += 4) {

        batch[0] = data[i];
        batch[1] = data[i+1];
        batch[2] = data[i+2];
        batch[3] = data[i+3];

        var alpha = data[i+3];
        batch.unshift(alpha);
        batch.pop();
        data[i] = batch[0];
        data[i+1] = batch[1];
        data[i+2] = batch[2];
        data[i+3] = batch[3];
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

        // attention, bgr to rgb convertion!
        outputBuffer[0] = (dataBuffer[0] << 2) + ((dataBuffer[1] & 0x30) >> 4);
        outputBuffer[1] = ((dataBuffer[1] & 0x0f) << 4) + ((dataBuffer[2] & 0x3c) >> 2);
        outputBuffer[2] = ((dataBuffer[2] & 0x03) << 6) + dataBuffer[3];
        for (var k = 0; k < outputBuffer.length; k++) {
            if (dataBuffer[k + 1] == 64) break;
            if (cnt >= 54) { // skip bmp header
                //if (cnt % 3 == 1) {
                //    output.writeByte(255); // add alpha channel
                //};
                output.writeByte(outputBuffer[k]);
            }
            cnt++;
        }
    }
    output = argb2rgba(output);
    output.position = 0;
    return output;
}

function loadBitmapData(width, height, raw) {
    var bmd = Bitmap.createBitmapData(width, height);
    //trace((extract(raw)).length);
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

function createBMPObj(width, height, raw, lifetime, scale, parent) {
    var obj = ObjPool.Create();
    var bmd;
    if (Global.CACHE.BMD.hasOwnProperty(raw)) {
        bmd = Global.CACHE.BMD[raw];
    } else {
        bmd = loadBitmapData(width, height, raw);
        Global.CACHE.BMD[raw] = bmd;
    }
    obj.shape = createBitmap(bmd, lifetime, scale, parent);
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
            HP : 100,
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
            BACKGROUND: "Qk02EAAAAAAAADYAAAAoAAAAIAAAAOD///8BACAAAAAAAAAQAAATCwAAEwsAAAAAAAAAAAAAQURB/0lISf9BREH/amxq/0FEQf9qaGr/QURB/2psav9BREH/SUhJ/0lISf9qaGr/QURB/0lISf9JSEn/SUhJ/0lISf9JSEn/QURB/2poav9qaGr/YmRi/0lISf9JSEn/SUhJ/0FEQf9qbGr/YmRi/0lISf9JSEn/QURB/0lISf9qbGr/QURB/2psav9BREH/amhq/0FEQf9qbGr/YmRi/2poav9BREH/QURB/0FEQf9qaGr/QURB/2JkYv9BREH/SUhJ/2JkYv9JSEn/QURB/2poav9BREH/SUhJ/2JkYv9BREH/amxq/0FAQf9qaGr/QURB/2JkYv9qbGr/YmRi/0lISf9JSEn/QURB/2psav9JSEn/amhq/2poav9JSEn/SUhJ/0FEQf9JSEn/amhq/0lISf9qaGr/amxq/2poav9qaGr/amhq/2poav9JSEn/SUhJ/0lESf9qbGr/QURB/2poav9BREH/amxq/2poav9qaGr/SUhJ/2poav9JSEn/amxq/0FEQf9qaGr/QURB/2psav9BREH/SUhJ/0FEQf9qbGr/QUhB/0FIQf9BREH/amxq/0FEQf9JSEn/QURB/0FEQf9JSEn/QURB/0lISf9BREH/QURB/0FEQf9qaGr/SUhJ/2poav9qaGr/amhq/2JkYv9qaGr/SUhJ/2poav9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/w==",
            SLM_GREEN : "Qk02EAAAAAAAADYAAAAoAAAAIAAAAOD///8BACAAAAAAAAAQAAATCwAAEwsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKrMqv+qzKr/qsyq/6rMqv+qzKr/qsyq/6rMqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKrMqv+qzKr/qsyq/8zuzP/M7sz/zO7M/8zuzP/M7sz/qsyq/6rMqv+qzKr/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqzKr/qsyq/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/6rMqv+qzKr/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAqsyq/6rMqv/M7sz/zO7M/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/6rMqv+qzKr/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKrMqv+qzKr/zO7M/8zMzP/MzMz/zMzM/8zuzP/M7sz/zO7M/8zuzP/M7sz/zMzM/8zMzP/MzMz/zO7M/6rMqv+qzKr/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAqsyq/8zuzP/MzMz/////////////////zMzM/8zuzP/M7sz/zO7M/8zMzP/////////////////MzMz/zO7M/6rMqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKrMqv+qzKr/zMzM////////////RERE/0RERP//////zMzM/8zuzP/MzMz//////0RERP9ERET////////////MzMz/qsyq/6rMqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAqsyq/8zuzP/MzMz///////////9ERET/zMzM///////MzMz/zO7M/8zMzP//////zMzM/0RERP///////////8zMzP+qzKr/qsyq/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqzKr/zO7M/8zMzP///////////0RERP9ERET//////8zMzP/M7sz/zMzM//////9ERET/RERE////////////zMzM/8zuzP+qzKr/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKrMqv/M7sz/zO7M/8zMzP/////////////////MzMz/zO7M/8zuzP/M7sz/zMzM/////////////////8zMzP/M7sz/qsyq/6rMqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAqsyq/6rMqv/M7sz/zO7M/8zMzP/MzMz/zMzM/8zuzP/M7sz/zO7M/8zuzP/M7sz/zMzM/8zMzP/MzMz/zO7M/6rMqv+qzKr/qsyq/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAqsyq/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/8zuzP/M7sz/qsyq/8zuzP+qzKr/zO7M/6rMqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqzKr/qsyq/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/8zuzP/M7sz/qsyq/8zuzP+qzKr/qsyq/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqzKr/qsyq/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/8zuzP+qzKr/zO7M/6rMqv/M7sz/qsyq/6rMqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqzKr/qsyq/6rMqv+qzKr/zO7M/6rMqv/M7sz/qsyq/8zuzP+qzKr/qsyq/6rMqv+qzKr/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKrMqv+qzKr/qsyq/6rMqv+qzKr/qsyq/6rMqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="
        }
    },
    CANVAS : {
        MAP_CANVAS : {},
        GUI_CANVAS : {},
        LEFT_STATUS_CANVAS : {},
        RIGHT_STATUS_CANVAS : {}
    },
    CACHE : {
        BMD : {}
    }
};

function MainLoop() {
}

function initMap() {
    Global.MAP.length = Global.MAP_SIZE.x;

    for (var i = 0; i < Global.MAP.length; i++) {
        Global.MAP[i] = [];
        Global.MAP[i].length = Global.MAP_SIZE.y;
    }

    for (var i = 0; i < Global.MAP_SIZE.x; i++) {
        for (var j = 0; j < Global.MAP_SIZE.y; j++) {
            Global.MAP[i][j]= {};
            Global.MAP[i][j].obj =  createBMPObj(32, 32, Global.RESOURCES.BITMAPS.BACKGROUND, 0, Global.MAP_SCALE, Global.CANVAS.MAP_CANVAS);

            Global.MAP[i][j].type = Global.BLOCK_TYPE.EMPTY;
            (Global.MAP[i][j].obj).shape.x = i * Global.BLOCK_SIZE.x;
            (Global.MAP[i][j].obj).shape.y = j * Global.BLOCK_SIZE.y;
            (Global.MAP[i][j].obj).onEntered = function() {
                var g = $.createShape({lifeTime:0,x:(this.absPos()).x,y:(this.absPos()).y});
                g.graphics.moveTo(0, 0);
                g.graphics.lineStyle(2, 0xFF4040, 1, false);
                g.graphics.lineTo(32, 0);
                g.graphics.lineTo(32, 32);
                g.graphics.lineTo(0, 32);
                g.graphics.lineTo(0, 0);
                this.g = g;
            };
            (Global.MAP[i][j].obj).onLeaved = function() {
                this.g.graphics.clear();
                this.g = {};
            };
        }
    }
}

function initPlayer() {
    Global.PLAYER = createBMPObj(32, 32, Global.RESOURCES.BITMAPS.SLM_GREEN, 0, Global.MAP_SCALE, Global.CANVAS.MAP_CANVAS);
    Global.PLAYER.shape.x = Global.BLOCK_SIZE.x * 5;
    Global.PLAYER.shape.y = Global.BLOCK_SIZE.y * 5;
    Global.PLAYER.x = 5;
    Global.PLAYER.y = 5;
    Global.PLAYER.status = Global.DATA.PLAYER;
    Global.MAP[5][5].obj = Global.PLAYER;
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
}

function placeObj() {

}

function keyDown(key) {
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

function init() {
    ScriptManager.clearTimer();
    ScriptManager.clearEl();
    ScriptManager.clearTrigger();

    Player.keyTrigger(function(key){
        keyDown(key);
    }, 1<<31 -1);

    $.frameRate = 30;
    $.root.addEventListener("enterFrame", MainLoop);

    $.root.mouseEnabled = true;
    $.root.addEventListener("mouseMove", function (e) {
        EventManager.MouseMove(e);
    });
    $.root.addEventListener("mouseUp", function (e) {
        EventManager.MouseUp(e);
    });

    //Global.CACHE.BMD.length = Global.BLOCK_TYPE.CNT;
    Global.BLOCK_SIZE.x = Global.BLOCK_SIZE.y = Math.min(Player.width / Global.MAP_SIZE.x, Player.height / Global.MAP_SIZE.y);
    Global.MAP_SCALE = Global.BLOCK_SIZE.x / 32;


    //Player.keyTrigger(function(key){
    //    keyUp(key);
    //},INT_MAX,true);

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

    var bmp = createBMPObj(32, 32, Global.RESOURCES.BITMAPS.SLM_GREEN, 0, Global.MAP_SCALE, Global.CANVAS.GUI_CANVAS);
    var bmp2 = createBMPObj(32, 32, Global.RESOURCES.BITMAPS.SLM_GREEN, 0, Global.MAP_SCALE, Global.CANVAS.GUI_CANVAS);
    bmp2.shape.x = 32 * Global.MAP_SCALE;
    bmp.onClicked = function() {
        //trace("bmp1 clicked");
    };
    bmp2.onClicked = function() {
        //trace("bmp2 clicked");
    };
    initMap();

}

function battleFrame(player, monster, turn) {
    if (turn) {
        player.status.HP -= 10;
        trace(player.status.HP);
        (Global.CANVAS.LEFT_STATUS_CANVAS.getChildByName("healthBar")).text = player.status.HP;
    } else {
        monster.status.HP -= 10;
        trace(monster.status.HP);
        (Global.CANVAS.RIGHT_STATUS_CANVAS.getChildByName("healthBar")).text = monster.status.HP;
    }

    turn = !turn;
    if (player.status.HP <= 0 || monster.status.HP <= 0) {
        return;
    }
    timer(function() {
        battleFrame(player, monster, turn);
    }, 400);
}

function enterBattle(player, monster) {
    timer(function() {
        battleFrame(player, monster, false);
    }, 1000);
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

    var health = createText("0", {x : 20, y : 50, parent : Global.CANVAS.LEFT_STATUS_CANVAS});
    health.name = "healthBar";

    var monsterHP = createText("0", {x : 20, y : 50, parent : Global.CANVAS.RIGHT_STATUS_CANVAS});
    monsterHP.name = "healthBar";



    initMap();
    initPlayer();

    var m = createBMPObj(32, 32, Global.RESOURCES.BITMAPS.SLM_GREEN, 0, Global.MAP_SCALE, Global.CANVAS.MAP_CANVAS);
    m.shape.x = Global.BLOCK_SIZE.x * 6;
    m.shape.y = Global.BLOCK_SIZE.y * 6;
    m.x = 6;
    m.y = 6;
    m.status = Global.DATA.SLM_GREEN;

    enterBattle(Global.PLAYER, m);

}

init();
gameInit();