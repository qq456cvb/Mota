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
                collidedObjects : [],
                speed : { x : 0, y : 0}
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
        this.target.Destroy();
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

        /* delay callback in case objects move. */
        Global.TIME += 1;

        var funcs = [];
        for (var i = 0; i < ObjPool.objects.length; ++i) {
            var obj = ObjPool.objects[i];
            if (!obj.rigid) continue;

            if (obj.__internal.lastPosition == null) {
                obj.__internal.lastPosition = {
                    x : (obj.absPos()).x,
                    y : (obj.absPos()).y
                };
            } else {
                /*compute speed direction*/

                obj.__internal.speed.x = (obj.absPos()).x - obj.__internal.lastPosition.x;
                obj.__internal.speed.y = (obj.absPos()).y - obj.__internal.lastPosition.y;

                obj.__internal.lastPosition.x = (obj.absPos()).x;
                obj.__internal.lastPosition.y = (obj.absPos()).y;
            }
        }

        var obj = Global.PLAYER;
        if (!obj.rigid) return;
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
                var direction, directionAnother;
                var angle = Math.atan2(obj.__internal.speed.y - anotherObj.__internal.speed.y,
                    obj.__internal.speed.x - anotherObj.__internal.speed.x);
                if (angle <= 3 * PIdiv4 && angle > PIdiv4) {
                    direction = "DOWN";
                    directionAnother = "UP";
                } else if (angle <= PIdiv4 && angle > -PIdiv4) {
                    direction = "RIGHT";
                    directionAnother = "LEFT";
                } else if (angle <= -PIdiv4 && angle > -3 * PIdiv4) {
                    direction = "UP";
                    directionAnother = "DOWN";
                } else {
                    direction = "LEFT";
                    directionAnother = "RIGHT";
                }
                funcs.push([obj.onCollision, anotherObj, direction]);
                if (anotherObj.hasOwnProperty('onCollision')) {
                    funcs.push([anotherObj.onCollision, obj, directionAnother]);
                }
            } else {
                /*lost*/
                var index = obj.__internal.collidedObjects.indexOf(anotherObj);
                if (index != -1) {
                    /*already in*/
                    obj.__internal.collidedObjects.splice(index, 1);
                }
            }
        }
        for (var i = 0; i < funcs.length; i++) {
            var func = funcs[i];
            var f = func[0];
            var arg1 = func[1];
            var arg2 = func[2];
            f(arg1, arg2);
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

function extractBase64(data) {
    var bmd = Bitmap.createBitmapData(1, 1);
    var output = bmd.getPixels(bmd.rect);
    output.clear();
    var dataBuffer = [];
    dataBuffer.length = 4;
    var outputBuffer = [];
    outputBuffer.length = 3;
    for (var i = 0; i < data.length; i += 4) {
        for (var j = 0; j < 4 && i + j < data.length; j++) {
            dataBuffer[j] = BASE64_CHARS.indexOf(data.charAt(i + j));
        }
        outputBuffer[0] = (dataBuffer[0] << 2) + ((dataBuffer[1] & 0x30) >> 4);
        outputBuffer[1] = ((dataBuffer[1] & 0x0f) << 4) + ((dataBuffer[2] & 0x3c) >> 2);
        outputBuffer[2] = ((dataBuffer[2] & 0x03) << 6) + dataBuffer[3];
        for (var k = 0; k < outputBuffer.length; k++) {
            if (dataBuffer[k + 1] == 64) break;
            output.writeByte(outputBuffer[k]);
        }
    }
    output.inflate();
    output.position = 0;
    return output;
}

function compressBase64(data)
{
    data.deflate();
    /*// Initialise output*/
    var output = [];

    /*// Create data and output buffers*/
    var dataBuffer = [];
    var outputBuffer = [];
    outputBuffer.length = 4;
    /*// Rewind ByteArray*/
    data.position = 0;


    /*// while there are still bytes to be processed*/
    while (data.bytesAvailable > 0) {
        /*// trace("wtf");
        // Create new data buffer and populate next 3 bytes from data*/
        dataBuffer.length = 3;
        for (var i = 0; i < 3 && data.bytesAvailable > 0; i++) {
            dataBuffer[i] = data.readUnsignedByte();
            /*// trace(dataBuffer[i].toString(16));*/
        }

        /*// Convert to data buffer Base64 character positions and
        // store in output buffer*/
        outputBuffer[0] = (dataBuffer[0] & 0xfc) >> 2;
        outputBuffer[1] = ((dataBuffer[0] & 0x03) << 4) | ((dataBuffer[1]) >> 4);
        outputBuffer[2] = ((dataBuffer[1] & 0x0f) << 2) | ((dataBuffer[2]) >> 6);
        outputBuffer[3] = dataBuffer[2] & 0x3f;

        /*// If data buffer was short (i.e not 3 characters) then set
        // end character indexes in data buffer to index of '=' symbol.
        // This is necessary because Base64 data is always a multiple of
        // 4 bytes and is basses with '=' symbols.*/
        for (var j = dataBuffer.length; j < 3; j++) {
            outputBuffer[j + 1] = 64;
        }

        /*// Loop through output buffer and add Base64 characters to
        // encoded data string for each character.*/
        for (var k = 0; k < outputBuffer.length; k++) {
            output += BASE64_CHARS.charAt(outputBuffer[k]);
        }
    }

    /*// Return encoded data*/
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

function createBMPObj(width, height, bmp_type, type, lifetime, scale, parent) {
    var obj = ObjPool.Create();
    var raw = Global.RESOURCES.BITMAPS[bmp_type];
    var bmd;
    if (Global.CACHE.BMD.hasOwnProperty(raw)) {
        bmd = Global.CACHE.BMD[raw];
    } else {
        bmd = loadBitmapData(width, height, raw);
        Global.CACHE.BMD[raw] = bmd;
    }
    obj.shape = createBitmap(bmd, lifetime, scale, parent);
    obj.bmp_type = bmp_type;
    obj.type = type;
    obj.parent = parent;
    return obj;
}
/***********************************************************************/
/******************************* map loader ****************************************/

function createByteArray() {
    var byte_arr = $G._get('byteArray');
    if (!byte_arr) {
        var bitmap_data = Bitmap.createBitmapData(1, 1);
        byte_arr = bitmap_data.getPixels(bitmap_data.rect);
        byte_arr.position = 0;
        byte_arr.length = 0;
        byte_arr.endian = 'littleEndian';
        $G._set('byteArray', byte_arr);
    }
    return clone(byte_arr);
}

function clearMap() {
    var x_size = Global.MAP_SIZE.x;
    var y_size = Global.MAP_SIZE.y;
    for (var i = 0; i < x_size; i++) {
        for (var j = 0; j < y_size; j++) {
            var objs = Global.CURRENT_MAP[i][j].objects;
            for (var k = 0; k < objs.length; k++) {
                var obj = objs[k];
                ScriptManager.popEl(obj.shape);
                obj.Destroy();
            }
            Global.CURRENT_MAP[i][j].objects = [];
        }
    }
}

function loadCurrentMap() {
    clearMap();
    (Global.CANVAS.LEFT_STATUS_CANVAS.getChildByName("floor")).text = Global.CURRENT_FLOOR + "";
    var idx = Global.FLOOR_IDS.indexOf(Global.CURRENT_FLOOR);
    var map_data = Global.MAPS[idx];
    if (map_data == null || map_data.length == 0) return;

    map_data.position = 0;
    var x_size = Global.MAP_SIZE.x;
    var y_size = Global.MAP_SIZE.y;

    for (var i = 0; i < x_size; i++) {
        for (var j = 0; j < y_size; j++) {
            var byte = parseInt(map_data.readUnsignedByte());
            if (byte != 0) {
                var type = Global.ID_TO_TYPE[byte].toString();
                var bmp_type = Global.TYPE_TO_BMPTYPE[type];
                var obj = placeObjWithTrigger(bmp_type, type, i, j, Global.CURRENT_MAP);
                if (map_data.position < map_data.length) {
                    if (parseInt(map_data.readUnsignedByte()) == 255) {
                        var specials_len = parseInt(map_data.readUnsignedByte());
                        var specials = [];
                        specials.length = specials_len;
                        for (var k = 0; k < specials_len; k++) {
                            specials[k] = parseInt(map_data.readUnsignedByte());
                        }
                        obj.specials = specials;
                    } else {
                        map_data.position -= 1;
                    }
                }
            }
        }
    }
}

/* [floor_ids], current_floor, [[maps, EOM], ...]  player status*/
function loadMaps(map_data) {
    Global.MAPS = [];
    Global.FLOOR_IDS = [];
    Global.CURRENT_FLOOR = -1;

    map_data.position = 0;
    while (true) {
        var floor_id = parseInt(map_data.readUnsignedByte());
        if (floor_id == 255) {
            break;
        } else {
            floor_id -= 128;
            Global.FLOOR_IDS.push(floor_id);
        }
    }
    Global.CURRENT_FLOOR = parseInt(map_data.readUnsignedByte()) - 128;
    var start_idx = map_data.position;
    var read = 0;
    while (read < Global.FLOOR_IDS.length) {
        if (map_data.readUnsignedByte() == 254) {
            var map = createByteArray();
            var end_idx = map_data.position - 1;
            map_data.position = start_idx;
            for (var j = start_idx; j < end_idx; j++) {
                map.writeByte(map_data.readUnsignedByte());
            }
            map_data.readUnsignedByte();
            Global.MAPS.push(map);
            read += 1;
            start_idx = map_data.position;
        }
    }
    loadCurrentMap();
}

function loadMapFromBase64(str) {
    var data = extractBase64(str);
    loadMaps(data);
}

function saveCurrentMap() {
    var idx = Global.FLOOR_IDS.indexOf(Global.CURRENT_FLOOR);
    Global.MAPS[idx] = createByteArray();
    var byte_arr = Global.MAPS[idx];
    var x_size = Global.MAP_SIZE.x;
    var y_size = Global.MAP_SIZE.y;
    for (var i = 0; i < x_size; i++) {
        for (var j = 0; j < y_size; j++) {
            var objs = Global.CURRENT_MAP[i][j].objects;
            if (objs.length == 0) {
                byte_arr.writeByte(0);
                continue;
            }
            var obj = objs[0];
            byte_arr.writeByte(Global.TYPE_TO_ID[obj.type.toString()]);
            if (obj.hasOwnProperty('specials')) {
                byte_arr.writeByte(255);
                var specials = obj.specials;
                byte_arr.writeByte(specials.length);
                for (var k = 0; k < specials.length; k++) {
                    byte_arr.writeByte(specials[k]);
                }
            }
        }
    }
}

function saveMaps() {
    saveCurrentMap();
    var byte_arr = createByteArray();
    for (var i = 0; i < Global.FLOOR_IDS.length; i++) {
        byte_arr.writeByte(Global.FLOOR_IDS[i] + 128);
    }
    byte_arr.writeByte(255);
    byte_arr.writeByte(Global.CURRENT_FLOOR + 128);
    for (var i = 0; i < Global.MAPS.length; i++) {
        var map_data = Global.MAPS[i];
        map_data.position = 0;
        for (var j = 0; j < map_data.length; j++) {
            var byte = map_data.readUnsignedByte();
            byte_arr.writeByte(byte);
        }
        byte_arr.writeByte(254);

    }
    return byte_arr;
}

function saveMap2Base64() {
    return compressBase64(saveMaps());
}

/* map_cnt, [[map_id, map]....], player status, player position */

/***********************************************************************/
function createRectangle(parent, color, x, y) {
    var g = $.createShape({parent: parent, lifeTime:0, x:0, y:0, name:"bg"});
    g.graphics.beginFill(color);
    g.graphics.drawRect(0,0,x,y);
    g.graphics.endFill();
    return g;
}

/*a2z63yiAFUhKSgoISIEBmAfjSCHLSKHKMIA4Yv+ZGdm4GSBA4j8jkERTgVUvpn0oLkEG/xiGCvgHAPgH*/

var Global = {
    PLAYER : {},
    CURRENT_MAP: {},
    CURRENT_FLOOR : 0,
    FLOOR_IDS : [],
    MAPS: [],
    MAP_SIZE: {
      x : 13,
      y : 13
    },
    TYPE_TO_ID : {
        "NPC_SHOP_A": 1,
        "NPC_SHOP_B": 2,
        "NPC_SHOP_C": 3,
        "NPC_TRADE" : 4,
        "KEY_YELLOW" : 5,
        "KEY_BLUE": 6,
        "KEY_RED" : 7,
        "PLAYER" : 8,
        "MN_SLM_GREEN" : 9,
        "MN_SLM_RED" : 10,
        "MN_MASTER_LOW" : 11,
        "MN_SKEL_LOW" : 12,
        "MN_SKEL_MID" : 13,
        "MN_BAT_LOW" : 14,
        "BACKGROUND" : 15,
        "BLK_WALL" : 16,
        "DOOR_YELLOW" : 17,
        "ATK_UP3" : 18,
        "DEF_UP3" : 19,
        "HP_UP200" : 20,
        "HP_UP500" : 21,
        "TRANSPORT_UP" : 22,
        "TRANSPORT_DOWN" : 23,
        "NPC_FAIRY" : 24,
        "BLK_LAVA" : 25,
        "BLK_VOID" : 26,
        "DOOR_RED" : 27,
        "DOOR_BLUE": 28,
        "EOM" : 254,
        "SPECIAL" : 255
    },
    ID_TO_TYPE : {},
    TYPE: {
        NPC_TRADE: "NPC_TRADE",
        KEY_YELLOW : "KEY_YELLOW",
        KEY_BLUE: "KEY_BLUE",
        KEY_RED : "KEY_RED",
        PLAYER : "PLAYER",
        MN_SLM_GREEN : "MN_SLM_GREEN",
        MN_SLM_RED : "MN_SLM_RED",
        MN_MASTER_LOW : "MN_MASTER_LOW",
        MN_SKEL_LOW : "MN_SKEL_LOW",
        MN_SKEL_MID : "MN_SKEL_MID",
        MN_BAT_LOW : "MN_BAT_LOW",
        BACKGROUND : "BACKGROUND",
        BLK_WALL : "BLK_WALL",
        DOOR_YELLOW : "DOOR_YELLOW",
        ATK_UP3 : "ATK_UP3",
        DEF_UP3: "DEF_UP3",
        HP_UP200: "HP_UP200",
        HP_UP500: "HP_UP500",
        TRANSPORT_UP : "TRANSPORT_UP",
        TRANSPORT_DOWN : "TRANSPORT_DOWN",
        NPC_FAIRY : "NPC_FAIRY",
        BLK_LAVA : "BLK_LAVA",
        NPC_SHOP_A: "NPC_SHOP_A",
        NPC_SHOP_B: "NPC_SHOP_B",
        NPC_SHOP_C: "NPC_SHOP_C",
        BLK_VOID : "BLK_VOID",
        DOOR_BLUE:"DOOR_BLUE",
        DOOR_RED: "DOOR_RED"
    },
    TYPE_TO_BMPTYPE : {
        "NPC_SHOP_A": "SHOP_A",
        "NPC_SHOP_B": "SHOP_B",
        "NPC_SHOP_C": "SHOP_C",
        "NPC_TRADE" : "NPC001",
        "KEY_YELLOW" : "KEY_YELLOW",
        "KEY_BLUE": "KEY_BLUE",
        "KEY_RED" : "KEY_RED",
        "PLAYER" : "WARRIOR_BLUE",
        "MN_SLM_GREEN" : "SLM_GREEN",
        "MN_SLM_RED" : "SLM_RED",
        "MN_MASTER_LOW" : "MASTER_LOW",
        "MN_SKEL_LOW" : "SKELETON",
        "MN_SKEL_MID" : "SKELETON_BLUE",
        "MN_BAT_LOW" : "BAT_LOW",
        "BACKGROUND" : "BACKGROUND",
        "BLK_WALL" : "WALL",
        "DOOR_YELLOW" : "DOOR_YELLOW",
        "DOOR_RED" : "DOOR_RED",
        "DOOR_BLUE" : "DOOR_BLUE",
        "ATK_UP3" : "GEM_RED",
        "DEF_UP3" : "GEM_BLUE",
        "HP_UP200" : "BOTTLE_RED",
        "HP_UP500" : "BOTTLE_BLUE",
        "TRANSPORT_UP" : "TRANSPORT_UP",
        "TRANSPORT_DOWN" : "TRANSPORT_DOWN",
        "NPC_FAIRY" : "NPC002",
        "BLK_LAVA" : "LAVA",
        "BLK_VOID" : "VOID"
    },
    BLOCK_SIZE: {
        x : 0,
        y : 0
    },
    DATA : {
        PLAYER : {
            HP : 999999,
            ATK : 20,
            DEF : 20,
            GOLD : 1000,
            EXP : 0
        },
        MN_SLM_GREEN : {
            HP : 35,
            ATK : 18,
            DEF : 1,
            GOLD : 1,
            EXP : 1
        },
        MN_SLM_RED : {
            HP : 45,
            ATK : 20,
            DEF : 2,
            GOLD : 2,
            EXP : 1
        },
        MN_MASTER_LOW : {
            HP : 60,
            ATK : 32,
            DEF : 8,
            GOLD : 5,
            EXP : 1
        },
        MN_SKEL_LOW : {
            HP : 50,
            ATK : 42,
            DEF : 6,
            GOLD : 6,
            EXP : 1
        },
        MN_SKEL_MID : {
            HP : 55,
            ATK : 52,
            DEF : 12,
            GOLD : 8,
            EXP : 1
        },
        MN_BAT_LOW: {
            HP : 35,
            ATK : 38,
            DEF : 3,
            GOLD : 3,
            EXP : 1
        }
    },
    MAP_SCALE: 0,
    RESOURCES : {
        BITMAPS : {
            DOOR_RED:"Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAABEZpz/RGaU/0RmnP9EZpz/RGac/0RmnP9EZpz/RGac/0RmnP9EZpz/RGac/0RmlP9EZpz/AAAAAAAAAABEZpT/RGac/0RmnP9EZpz/RGac/0RmnP9EZpz/RGac/0RmnP9EZpz/RGac/0RmnP9EZpz/AAAAAAAAAAAAAAAARGaU/0RmnP9sZtz/ZGbc/2Rm3P9sZtz/ZGbc/2Rm3P9kZtz/ZGbc/2xq3P9kZtz/RGaU/0RmnP9EZpT/RGac/0RmlP9EZpz/ZGbc/2Rm3P9sZtz/ZGbc/2Rm3P9kZtz/bGrc/2Rm3P9satz/ZGbc/0RmnP9EZpz/AAAAAERmnP9EZpz/ZGbc/2Rm3P+Mivz/jIr8/4SK/P+Mivz/jIr8/4yK/P+Mivz/hIr8/2xm3P9katz/RGac/0RmlP9EZpz/RGaU/2Rm3P9satz/jIr8/4SK/P+Mivz/jIr8/4SK/P+Mhvz/hIr8/4yG/P9kZtz/ZGbc/0RmlP9EZpz/RGac/2Rm3P9kZtz/jIr8/4yK/P9kZtz/ZGbc/2Rm3P9kZtz/ZGbc/2Rm3P+Mivz/jIr8/2Rm3P9kZtz/RGac/0RmnP9sZtz/ZGbc/4SK/P+Mivz/ZGbc/2Rm3P9sZtz/ZGbc/2Rq3P9kZtz/jIb8/4SK/P9sZtz/ZGbc/0RmnP9EZpz/bGrc/4SK/P+Mivz/RGac/0RmnP9EZpz/RGac/0RmnP9EZpz/RGac/2Rm3P+Mivz/hIr8/2xm3P9EZpz/RGaU/2Rm3P+Mivz/jIr8/2Rm3P9EZpz/RGac/0RmnP9EZpz/RGac/0RmnP9EZpz/jIr8/4SK/P9sZtz/RGac/0RmlP9sZtz/hIr8/0RmnP+Mhvz/hIr8/4yK/P+Mivz/hIr8/4yK/P+Mivz/RGac/2Rm3P+Mivz/ZGbc/0RmlP9EZpz/ZGbc/4yK/P9kZtz/RGac/4yK/P+Eivz/jIr8/4SK/P+Mivz/hIr8/4yG/P9EZpz/jIr8/2Rm3P9EZpT/RGac/2Rm3P+Mivz/RGac/4SK/P9EZpz/RGac/0RmnP9EZpz/RGaU/4yG/P9EZpz/ZGbc/4yG/P9kZtz/RGac/0RmnP9kZtz/jIr8/2Rm3P9EZpz/jIb8/0RmnP9EZpz/RGac/0RmnP9EZpz/hIr8/0RmnP+Mivz/ZGbc/0RmnP9EZpT/ZGrc/4yG/P9EZpz/jIr8/0RmnP9kZtz/ZGbc/2Rm3P9EZpz/hIr8/0RmnP9kZtz/jIr8/2Rm3P9EZpT/RGac/2Rm3P+Mivz/ZGbc/0RmnP+Eivz/RGaU/2Rm3P9sZtz/ZGbc/0RmnP+Eivz/RGac/4yK/P9kZtz/RGaU/0RmnP9kZtz/hIr8/0RmnP+Eivz/RGac/2xm3P9kZtz/bGbc/0RmnP+Mivz/RGac/2Rm3P+Mivz/ZGbc/0RmnP9EZpT/bGrc/4SK/P9sZtz/RGac/4yG/P9EZpz/ZGbc/2Rm3P9sZtz/RGaU/4yG/P9EZpz/hIr8/2xm3P9EZpz/RGac/2Rm3P+Mivz/RGac/4yK/P9EZpT/bGbc/2Rq3P9kZtz/RGac/4yG/P9EZpz/ZGbc/4yK/P9kZtz/RGac/0RmnP9kZtz/jIr8/2Rm3P9EZpz/jIr8/0RmnP9kZtz/bGbc/2Rm3P9EZpz/hIr8/0RmnP+Mivz/ZGbc/0RmnP9EZpT/ZGbc/4yK/P9EZpz/jIb8/0RmnP9kZtz/ZGbc/4yK/P+Eivz/hIr8/0RmnP9kZtz/jIr8/2Rm3P9EZpz/RGaU/2Rm3P+Mivz/ZGbc/0RmnP+Eivz/jIr8/4yK/P9kZtz/ZGrc/0RmnP+Mivz/RGac/4SK/P9sZtz/RGaU/0RmnP9sZtz/hIr8/0RmnP+Eivz/RGac/2Rq3P9sZtz/RGac/0RmnP9EZpz/ZGbc/2Rm3P+Mivz/ZGbc/2Rm3P9EZpz/bGbc/4SK/P9sZtz/ZGbc/0RmnP9EZpz/RGac/2xm3P9kZtz/RGac/4yG/P9EZpz/jIr8/2Rm3P9EZpz/RGac/2Rm3P+Mivz/RGac/4SK/P9EZpz/ZGbc/2Rm3P9satz/ZGbc/2xm3P9sZtz/jIr8/4SK/P9sZtz/ZGrc/0RmnP9kZtz/hIr8/4yK/P9kZtz/bGbc/2Rm3P9kZtz/ZGrc/2xm3P9EZpz/hIr8/0RmnP+Mivz/ZGbc/0RmnP9EZpz/bGbc/4SK/P9EZpz/jIr8/0RmnP9katz/bGbc/2Rm3P9kZtz/hIr8/4yG/P+Eivz/bGbc/2Rm3P9sZtz/ZGbc/2xm3P9kZtz/jIr8/4SK/P+Mivz/ZGrc/2xm3P9kZtz/ZGbc/0RmnP+Mivz/RGac/4SK/P9sZtz/RGac/0RmlP9kZtz/jIr8/0RmnP+Mhvz/RGac/2Rm3P9kZtz/bGrc/4SK/P+Mivz/ZGbc/0RmnP9EZpz/ZGrc/2Rm3P9sZtz/ZGrc/0RmnP9EZpz/ZGbc/4yK/P+Mhvz/ZGbc/2xq3P9kZtz/RGac/4SK/P9EZpz/jIb8/2Rm3P9EZpT/RGac/2xm3P+Eivz/RGac/4SK/P9EZpz/ZGrc/2xm3P9kZtz/jIr8/2xm3P9EZpz/RGaU/0RmnP9EZpz/ZGrc/2Rm3P9EZpz/RGaU/0RmnP9EZpz/ZGbc/4SK/P9sZtz/ZGbc/2Rm3P9EZpz/jIr8/0RmnP+Eivz/bGbc/0RmnP9EZpz/ZGbc/4yK/P9EZpz/jIr8/0RmnP9kZtz/ZGbc/2xm3P+Eivz/ZGbc/0RmnP8AAAAARGac/0RmlP9kZtz/bGbc/0RmnP8AAAAARGaU/0RmnP9kZtz/jIr8/2Rm3P9sZtz/ZGbc/0RmnP+Eivz/RGac/4yK/P9kZtz/RGac/0RmnP9kZtz/jIr8/0RmnP+Eivz/RGac/2Rm3P9satz/ZGbc/4yK/P+Mivz/ZGbc/0RmlP9EZpz/ZGbc/2xm3P9katz/ZGbc/0RmnP9EZpz/ZGbc/4yK/P+Mivz/ZGbc/2xq3P9kZtz/RGac/4yG/P9EZpz/hIr8/2xm3P9EZpz/RGaU/2Rm3P+Mivz/RGac/4yG/P9EZpz/ZGbc/2Rm3P9sZtz/ZGbc/4yK/P+Eivz/jIr8/2Rm3P9kZtz/ZGbc/2xm3P9kZtz/ZGrc/4yG/P+Eivz/jIr8/2Rm3P9kZtz/ZGbc/2xm3P9EZpz/hIr8/0RmnP+Mivz/ZGbc/0RmlP9EZpz/bGbc/4SK/P9EZpz/hIr8/0RmnP9katz/bGbc/2Rq3P9kZtz/ZGbc/2Rm3P+Mhvz/jIr8/2xm3P9katz/RGac/2Rm3P+Mhvz/hIr8/2xm3P9kZtz/bGbc/2Rm3P9sZtz/ZGrc/0RmnP+Mivz/RGac/4SK/P9sZtz/RGac/0RmnP9kZtz/jIr8/0RmnP+Mivz/RGac/2Rm3P9sZtz/RGac/0RmnP9EZpz/ZGbc/2Rq3P+Mivz/ZGbc/2xm3P9EZpz/bGrc/4yK/P9kZtz/ZGbc/0RmnP9EZpz/RGac/2Rm3P9kZtz/RGac/4yK/P9EZpz/jIb8/2Rm3P9EZpz/RGac/2Rm3P+Mivz/RGac/4SK/P9EZpz/bGbc/2Rm3P+Mivz/jIr8/4yK/P9EZpz/ZGbc/4yK/P9katz/RGac/0RmnP9kZtz/hIr8/2xm3P9EZpz/hIr8/4yG/P+Mivz/ZGrc/2xm3P9EZpz/hIr8/0RmnP+Eivz/bGbc/0RmnP9EZpT/ZGbc/4yK/P9EZpz/jIb8/0RmnP9kZtz/ZGrc/2Rm3P9EZpz/jIr8/0RmnP9sZtz/hIr8/2xm3P9EZpT/RGac/2Rm3P+Mivz/ZGbc/0RmnP+Mivz/RGac/2Rm3P9kZtz/ZGbc/0RmnP+Mivz/RGac/4yK/P9kZtz/RGaU/0RmnP9sZtz/hIr8/0RmnP+Eivz/RGac/2Rm3P9sZtz/ZGbc/0RmnP+Eivz/RGac/2Rm3P+Mivz/ZGbc/0RmlP9EZpz/ZGbc/4yK/P9kZtz/RGac/4SK/P9EZpz/ZGbc/2xq3P9kZtz/RGac/4yG/P9EZpz/jIr8/2Rm3P9EZpz/RGac/2Rm3P+Mivz/RGac/4SK/P9EZpz/bGbc/2Rq3P9sZtz/RGac/4yK/P9EZpz/ZGbc/4yK/P9kZtz/RGac/0RmlP9kZtz/jIr8/2Rm3P9EZpz/jIr8/0RmnP9kZtz/ZGbc/2xm3P9EZpz/hIr8/0RmnP+Eivz/bGbc/0RmnP9EZpT/ZGbc/4SK/P9EZpz/jIr8/0RmlP9EZpz/RGac/0RmlP9EZpz/jIb8/0RmnP9kZtz/jIr8/2Rm3P9EZpz/RGac/2Rm3P+Mivz/ZGbc/0RmnP+Mhvz/RGac/0RmlP9EZpz/RGac/0RmlP+Eivz/RGac/4yK/P9kZtz/RGaU/0RmnP9kZtz/jIr8/0RmnP+Eivz/jIb8/4SK/P+Mivz/hIr8/4SK/P+Eivz/RGac/2Rm3P+Mivz/ZGbc/0RmlP9EZpz/ZGbc/4yK/P9kZtz/RGac/4yK/P+Eivz/jIr8/4yK/P+Eivz/jIr8/4yG/P9EZpz/hIr8/2Rm3P9EZpz/RGac/2xm3P+Eivz/jIr8/0RmnP9EZpz/RGac/0RmnP9EZpz/RGac/0RmnP9kZtz/jIr8/4yK/P9kZtz/RGac/0RmnP9kZtz/jIr8/4yK/P9kZtz/RGac/0RmnP9EZpz/RGac/0RmnP9EZpz/RGac/4SK/P+Mivz/bGbc/0RmnP9EZpz/ZGrc/2Rm3P+Mivz/jIb8/2Rm3P9kZtz/ZGbc/2xm3P9kZtz/bGbc/4yK/P+Eivz/ZGbc/2xm3P9EZpz/RGaU/2Rm3P9kZtz/jIr8/4yK/P9kZtz/ZGbc/2Rm3P9kZtz/ZGbc/2Rm3P+Mhvz/jIr8/2Rm3P9kZtz/RGac/0RmlP9EZpz/bGbc/2Rm3P+Mivz/hIr8/4yK/P+Mivz/hIr8/4yK/P+Eivz/jIb8/2xq3P9kZtz/RGac/0RmlP9EZpz/RGac/2Rm3P9sZtz/hIr8/4yK/P+Mhvz/jIr8/4SK/P+Mivz/hIr8/4yG/P9kZtz/ZGbc/0RmnP9EZpT/AAAAAERmnP9EZpz/ZGbc/2Rm3P9kZtz/ZGbc/2Rm3P9kZtz/bGbc/2Rm3P9kZtz/ZGbc/0RmnP9EZpz/RGaU/0RmnP9EZpT/RGac/2Rm3P9kZtz/bGbc/2Rm3P9kZtz/ZGbc/2xm3P9kZtz/ZGrc/2Rm3P9EZpz/RGaU/wAAAAAAAAAAAAAAAERmnP9EZpT/RGac/0RmnP9EZpz/RGac/0RmnP9EZpz/RGac/0RmnP9EZpz/RGaU/0RmnP8AAAAAAAAAAERmlP9EZpz/RGac/0RmnP9EZpz/RGac/0RmnP9EZpz/RGac/0RmnP9EZpz/RGac/0RmnP8AAAAAAAAAAA==",
            DOOR_BLUE:"Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAC8ioz/vIqE/7yKjP+8ioT/vIaM/7yKhP+8ioz/vIaE/7yKjP+8hoT/vIqM/7yKjP+8hoT/AAAAAAAAAAC8hoz/vIqE/7yGjP+8ioT/vIaM/7yKjP+8ioT/vIaM/7yKhP+8hoz/vIqM/7yKhP+8ioz/AAAAAAAAAAAAAAAAvIqM/7yGjP/cqqz/3Kqs/9yqrP/cqqz/3Kqs/9yqrP/cqqz/3Kqs/9yqrP/cqqz/vIaE/7yKjP+8hoz/vIqM/7yGjP+8ioT/3Kqs/9yqrP/cqqz/3Kqs/9yqrP/cqqz/3Kqs/9yqrP/cqqz/3Kqs/7yGjP+8ioz/AAAAALyKjP+8hoT/3Kqs/9yqrP/8ysz//M7M//zKzP/8ysz//M7M//zKzP/8zsz//M7M/9yqrP/cqqz/vIaE/7yKhP+8hoz/vIqE/9yqrP/cqqz//M7M//zKzP/8zsz//MrM//zOzP/8ysz//M7M//zKzP/cqqz/3Kqs/7yKhP+8hoz/vIqE/9yqrP/cqqz//M7M//zKzP/cqqz/3Kqs/9yqrP/cqqz/3Kqs/9yqrP/8ysz//M7M/9yqrP/cqqz/vIqM/7yKhP/cqqz/3Kqs//zKzP/8ysz/3Kqs/9yqrP/cqqz/3Kqs/9yqrP/cqqz//MrM//zOzP/cqqz/3Kqs/7yKjP+8hoz/3Kqs//zOzP/8ysz/vIqE/7yGhP+8ioT/vIqE/7yGhP+8ioT/vIaE/9yqrP/8ysz//MrM/9yqrP+8ioT/vIaM/9yqrP/8ysz//M7M/9yqrP+8ioT/vIaE/7yKhP+8hoT/vIqE/7yKhP+8hoT//MrM//zOzP/cqqz/vIaE/7yKhP/cqqz//M7M/7yGhP/8zsz//MrM//zKzP/8zsz//MrM//zOzP/8ysz/vIqE/9yqrP/8zsz/3Kqs/7yKhP+8hoT/3Kqs//zOzP/cqqz/vIqE//zKzP/8zsz//MrM//zOzP/8ysz//MrM//zOzP+8ioT//MrM/9yqrP+8ioT/vIaM/9yqrP/8ysz/vIqE//zKzP+8ioz/vIaE/7yKjP+8hoz/vIqM//zKzP+8ioT/3Kqs//zKzP/cqqz/vIaE/7yKjP/cqqz//MrM/9yqrP+8hoT//M7M/7yKjP+8hoT/vIqM/7yGhP+8ioz//MrM/7yGhP/8zsz/3Kqs/7yGhP+8ioT/3Kqs//zKzP+8ioz//MrM/7yKhP/cqqz/3Kqs/9yqrP+8hoT//M7M/7yGhP/cqqz//MrM/9yqrP+8ioT/vIqE/9yqrP/8ysz/3Kqs/7yKjP/8ysz/vIqE/9yqrP/cqqz/3Kqs/7yGhP/8zsz/vIqM//zKzP/cqqz/vIqM/7yKhP/cqqz//M7M/7yGhP/8zsz/vIaM/9yqrP/cqqz/3Kqs/7yKhP/8ysz/vIqM/9yqrP/8ysz/3Kqs/7yGhP+8hoT/3Kqs//zOzP/cqqz/vIaE//zOzP+8hoz/3Kqs/9yqrP/cqqz/vIqE//zKzP+8ioT//MrM/9yqrP+8hoT/vIaE/9yqrP/8ysz/vIqE//zKzP+8ioT/3Kqs/9yqrP/cqqz/vIqE//zKzP+8hoT/3Kqs//zOzP/cqqz/vIqM/7yKhP/cqqz//MrM/9yqrP+8ioT//MrM/7yKhP/cqqz/3Kqs/9yqrP+8hoz//M7M/7yGhP/8zsz/3Kqs/7yKjP+8ioz/3Kqs//zOzP+8hoz//M7M/7yGhP/cqqz/3Kqs//zOzP/8ysz//M7M/7yKhP/cqqz//MrM/9yqrP+8hoT/vIaE/9yqrP/8ysz/3Kqs/7yKhP/8ysz//M7M//zKzP/cqqz/3Kqs/7yKhP/8ysz/vIqM//zKzP/cqqz/vIaE/7yGhP/cqqz//MrM/7yKhP/8ysz/vIqE/9yqrP/cqqz/vIqE/7yKjP+8hoT/3Kqs/9yqrP/8zsz/3Kqs/9yqrP+8ioT/3Kqs//zOzP/cqqz/3Kqs/7yGjP+8ioT/vIqE/9yqrP/cqqz/vIaE//zOzP+8hoT//M7M/9yqrP+8ioz/vIqM/9yqrP/8zsz/vIaE//zOzP+8hoz/3Kqs/9yqrP/cqqz/3Kqs/9yqrP/cqqz//MrM//zOzP/cqqz/3Kqs/7yKhP/cqqz//MrM//zKzP/cqqz/3Kqs/9yqrP/cqqz/3Kqs/9yqrP+8ioT//MrM/7yKjP/8ysz/3Kqs/7yGhP+8hoT/3Kqs//zKzP+8ioz//MrM/7yKhP/cqqz/3Kqs/9yqrP/cqqz//MrM//zOzP/8ysz/3Kqs/9yqrP/cqqz/3Kqs/9yqrP/cqqz//M7M//zKzP/8zsz/3Kqs/9yqrP/cqqz/3Kqs/7yGhP/8zsz/vIaE//zOzP/cqqz/vIqE/7yKjP/cqqz//M7M/7yGhP/8zsz/vIaE/9yqrP/cqqz/3Kqs//zOzP/8ysz/3Kqs/7yKhP+8hoT/3Kqs/9yqrP/cqqz/3Kqs/7yGhP+8ioT/3Kqs//zKzP/8ysz/3Kqs/9yqrP/cqqz/vIqE//zKzP+8ioz//MrM/9yqrP+8hoT/vIaE/9yqrP/8ysz/vIqM//zKzP+8ioT/3Kqs/9yqrP/cqqz//M7M/9yqrP+8hoT/vIqE/7yGhP+8ioT/3Kqs/9yqrP+8ioT/vIqE/7yGhP+8ioT/3Kqs//zOzP/cqqz/3Kqs/9yqrP+8hoT//M7M/7yGhP/8zsz/3Kqs/7yKjP+8ioT/3Kqs//zOzP+8hoT//M7M/7yGhP/cqqz/3Kqs/9yqrP/8ysz/3Kqs/7yKhP8AAAAAvIqM/7yGhP/cqqz/3Kqs/7yGhP8AAAAAvIqM/7yGhP/cqqz//M7M/9yqrP/cqqz/3Kqs/7yKhP/8ysz/vIqM//zKzP/cqqz/vIaE/7yGhP/cqqz//MrM/7yKjP/8ysz/vIqE/9yqrP/cqqz/3Kqs//zKzP/8zsz/3Kqs/7yGjP+8ioT/3Kqs/9yqrP/cqqz/3Kqs/7yKjP+8hoT/3Kqs//zOzP/8ysz/3Kqs/9yqrP/cqqz/vIaE//zOzP+8hoT//M7M/9yqrP+8ioT/vIqM/9yqrP/8zsz/vIaE//zOzP+8hoT/3Kqs/9yqrP/cqqz/3Kqs//zOzP/8ysz//M7M/9yqrP/cqqz/3Kqs/9yqrP/cqqz/3Kqs//zKzP/8ysz//M7M/9yqrP/cqqz/3Kqs/9yqrP+8ioT//MrM/7yKjP/8ysz/3Kqs/7yGhP+8hoT/3Kqs//zKzP+8ioz//MrM/7yKhP/cqqz/3Kqs/9yqrP/cqqz/3Kqs/9yqrP/8ysz//MrM/9yqrP/cqqz/vIqE/9yqrP/8zsz//M7M/9yqrP/cqqz/3Kqs/9yqrP/cqqz/3Kqs/7yGhP/8zsz/vIaE//zOzP/cqqz/vIqM/7yKhP/cqqz//M7M/7yGhP/8zsz/vIaE/9yqrP/cqqz/vIqE/7yGhP+8ioT/3Kqs/9yqrP/8zsz/3Kqs/9yqrP+8ioT/3Kqs//zKzP/cqqz/3Kqs/7yKhP+8hoT/vIqE/9yqrP/cqqz/vIqE//zKzP+8ioz//MrM/9yqrP+8hoT/vIaE/9yqrP/8ysz/vIqM//zKzP+8ioT/3Kqs/9yqrP/8ysz//M7M//zKzP+8ioT/3Kqs//zKzP/cqqz/vIaE/7yGhP/cqqz//MrM/9yqrP+8ioT//MrM//zOzP/8ysz/3Kqs/9yqrP+8hoT//M7M/7yGhP/8zsz/3Kqs/7yKhP+8ioz/3Kqs//zOzP+8hoT//M7M/7yGhP/cqqz/3Kqs/9yqrP+8hoT//M7M/7yGhP/cqqz//M7M/9yqrP+8ioT/vIaE/9yqrP/8zsz/3Kqs/7yGhP/8ysz/vIqE/9yqrP/cqqz/3Kqs/7yKhP/8ysz/vIqM//zKzP/cqqz/vIaE/7yGhP/cqqz//MrM/7yKjP/8ysz/vIqE/9yqrP/cqqz/3Kqs/7yKhP/8zsz/vIqE/9yqrP/8ysz/3Kqs/7yKhP+8ioT/3Kqs//zKzP/cqqz/vIqE//zOzP+8hoT/3Kqs/9yqrP/cqqz/vIaE//zOzP+8hoT//M7M/9yqrP+8ioz/vIqE/9yqrP/8ysz/vIqE//zKzP+8ioT/3Kqs/9yqrP/cqqz/vIaE//zKzP+8ioT/3Kqs//zOzP/cqqz/vIqE/7yKhP/cqqz//MrM/9yqrP+8hoT//M7M/7yKhP/cqqz/3Kqs/9yqrP+8ioT//MrM/7yKjP/8ysz/3Kqs/7yGhP+8hoT/3Kqs//zKzP+8ioT//MrM/7yKjP+8hoT/vIqE/7yKhP+8ioz//M7M/7yGhP/cqqz//MrM/9yqrP+8hoz/vIaE/9yqrP/8ysz/3Kqs/7yKhP/8ysz/vIqE/7yGhP+8ioT/vIqE/7yKhP/8ysz/vIqE//zKzP/cqqz/vIqE/7yKjP/cqqz//M7M/7yGjP/8zsz//MrM//zKzP/8zsz//MrM//zKzP/8zsz/vIaE/9yqrP/8zsz/3Kqs/7yKhP+8ioT/3Kqs//zKzP/cqqz/vIaE//zOzP/8ysz//M7M//zKzP/8ysz//MrM//zOzP+8hoz//M7M/9yqrP+8hoT/vIaE/9yqrP/8zsz//MrM/7yGhP+8ioT/vIqM/7yGhP+8ioT/vIaM/7yKhP/cqqz//MrM//zKzP/cqqz/vIaM/7yGhP/cqqz//M7M//zKzP/cqqz/vIaM/7yKjP+8hoT/vIqM/7yKhP+8hoz/vIqE//zKzP/8ysz/3Kqs/7yKjP+8ioz/3Kqs/9yqrP/8zsz//MrM/9yqrP/cqqz/3Kqs/9yqrP/cqqz/3Kqs//zKzP/8zsz/3Kqs/9yqrP+8ioT/vIqE/9yqrP/cqqz//MrM//zOzP/cqqz/3Kqs/9yqrP/cqqz/3Kqs/9yqrP/8ysz//M7M/9yqrP/cqqz/vIaE/7yKhP+8hoT/3Kqs/9yqrP/8zsz//MrM//zOzP/8ysz//M7M//zKzP/8zsz//M7M/9yqrP/cqqz/vIqE/7yKjP+8hoT/vIqE/9yqrP/cqqz//MrM//zOzP/8ysz//M7M//zKzP/8zsz//MrM//zOzP/cqqz/3Kqs/7yGhP+8ioz/AAAAALyKjP+8hoT/3Kqs/9yqrP/cqqz/3Kqs/9yqrP/cqqz/3Kqs/9yqrP/cqqz/3Kqs/7yKhP+8hoT/vIaM/7yKjP+8hoT/vIqE/9yqrP/cqqz/3Kqs/9yqrP/cqqz/3Kqs/9yqrP/cqqz/3Kqs/9yqrP+8hoT/vIqM/wAAAAAAAAAAAAAAALyKjP+8ioT/vIqM/7yGhP+8ioT/vIaE/7yKhP+8hoT/vIaE/7yKhP+8hoT/vIqE/7yKjP8AAAAAAAAAALyGjP+8hoz/vIqE/7yKhP+8hoT/vIqE/7yKhP+8hoT/vIqE/7yGhP+8ioT/vIqE/7yKjP8AAAAAAAAAAA==",
            SHOP_A: "Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr/u4iI/7uIiP/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv+7iIj/u4iI/92qqv/dqqr/3aqq/92qqv+7iIj/u4iI/wAAAAAAAAAAu4iI/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAALuIiP/dqqr/3aqq/92qqv//zMz//8zM/92qqv+7iIj/u4iI/92qqv/dqqr//8zM///MzP/dqqr/3aqq/7uIiP+7iIj/3aqq///MzP//zMz/3aqq/92qqv+7iIj/AAAAALuIiP/dqqr/3aqq/92qqv8AAAAAAAAAAAAAAAAAAAAAu4iI/92qqv/dqqr//8zM///MzP//zMz/3aqq/7uIiP+7iIj/3aqq///MzP//zMz//8zM///MzP/dqqr/u4iI/7uIiP/dqqr//8zM///MzP//zMz/3aqq/7uIiP+7iIj/3aqq/92qqv/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq///MzP//zMz//8zM///MzP/dqqr/u4iI/7uIiP/dqqr//8zM///MzP//zMz//8zM/92qqv+7iIj/u4iI/92qqv//zMz//8zM///MzP/dqqr/u4iI/92qqv/dqqr/3aqq/7uIiP/dqqr/AAAAAAAAAAAAAAAAAAAAALuIiP/dqqr//8zM///MzP//zMz//8zM/92qqv+7iIj/u4iI/92qqv//zMz//8zM///MzP//zMz/3aqq/7uIiP+7iIj/3aqq///MzP//zMz//8zM/92qqv+7iIj/3aqq/92qqv+7iIj/3aqq/92qqv8AAAAAAAAAAAAAAAAAAAAAu4iI/92qqv//zMz//8zM///MzP//zMz//8zM/92qqv/dqqr//8zM///MzP//zMz//8zM///MzP//zMz/3aqq/92qqv//zMz//8zM///MzP//zMz/3aqq/7uIiP/dqqr/3aqq/7uIiP/dqqr//8zM/wAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/92qqv//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM/92qqv/dqqr/u4iI/7uIiP+7iIj/u4iI/92qqv/dqqr/AAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/7uIiP+7iIj/3aqq/92qqv+7iIj/u4iI/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/92qqv//zMz//8zM/7uIiP/dqqr/3aqq/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/u4iI/7uIiP/dqqr/3aqq/92qqv+7iIj/u4iI/92qqv//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv/dqqr/3aqq///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM/92qqv/dqqr/3aqq/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/3aqq///MzP8AAAAAAAAAAAAAAAAAAAAAAAAAALuIiP/dqqr/3aqq/92qqv//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz/3aqq/92qqv+7iIj/u4iI/92qqv/dqqr/3aqq/7uIiP+7iIj/3aqq/7uIiP/dqqr//8zM/wAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/92qqv/dqqr//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM/92qqv/dqqr/u4iI/7uIiP/dqqr//8zM///MzP+7iIj/u4iI/92qqv/dqqr/u4iI/92qqv//zMz/AAAAAAAAAAAAAAAAu4iI/92qqv/dqqr/3aqq///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP/dqqr/3aqq/7uIiP+7iIj/3aqq/92qqv/dqqr/u4iI/7uIiP/dqqr/3aqq/92qqv+7iIj/3aqq/92qqv8AAAAAAAAAALuIiP/dqqr/3aqq/92qqv/dqqr//8zM////////zMz//8zM///MzP//zMz//8zM///MzP//zMz/3aqq/92qqv+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/3aqq/92qqv/dqqr/3aqq/7uIiP+7iIj/u4iI/wAAAAC7iIj/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr//////////////////8zM///MzP//zMz//8zM/92qqv/dqqr/u4iI/7uIiP/dqqr/3aqq/92qqv+7iIj/u4iI/92qqv/dqqr//8zM///MzP/dqqr/u4iI/92qqv/dqqr/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/7uIiP+7iIj/3aqq///MzP//zMz/u4iI/7uIiP/dqqr/3aqq///MzP//zMz//8zM/92qqv+7iIj/3aqq///MzP+7iIj/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv+7iIj/u4iI/92qqv/dqqr/3aqq/7uIiP+7iIj/3aqq/92qqv//zMz//8zM///MzP//zMz/3aqq/7uIiP/dqqr//8zM/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/wAAAAC7iIj/3aqq///MzP//zMz//8zM///MzP/dqqr/u4iI/92qqv//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP/dqqr//8zM///MzP//zMz//8zM/92qqv+7iIj/3aqq/92qqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv//zMz//8zM///MzP//zMz/3aqq/7uIiP/dqqr/3aqq/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/92qqv//zMz//8zM/92qqv/dqqr/u4iI/92qqv/dqqr/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/3aqq/92qqv/dqqr/3aqq/92qqv+7iIj/3aqq/92qqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP/dqqr/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/u4iI/w==",
            SHOP_B: "Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/7uIiP/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv+7iIj/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr//8zM///MzP//zMz//8zM/92qqv+7iIj//8zM///MzP//zMz//8zM///MzP/dqqr/u4iI/92qqv//zMz//8zM///MzP//zMz/3aqq/7uIiP/dqqr//8zM///MzP//zMz//8zM///MzP+7iIj/3aqq///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz/3aqq/7uIiP//zMz/3aqq/92qqv/dqqr/3aqq/92qqv+7iIj/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr//8zM/7uIiP/dqqr//8zM///MzP//zMz//8zM/92qqv/dqqr/3aqq/92qqv/dqqr/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/7uIiP/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv+7iIj/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/3aqq/92qqv+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/3aqq/92qqv+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP//zMz//8zM/92qqv/dqqr/3aqq/92qqv+7iIj/u4iI/7uIiP/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/7uIiP+7iIj/u4iI/92qqv/dqqr/3aqq/92qqv//zMz//8zM///MzP//zMz//8zM/92qqv/dqqr/u4iI/7uIiP/dqqr/3aqq/92qqv//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP/dqqr/3aqq/92qqv+7iIj/u4iI/92qqv/dqqr//8zM///MzP//zMz//8zM///MzP//zMz/3aqq/92qqv+7iIj/3aqq/92qqv//zMz//8zM/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq///MzP//zMz/3aqq/92qqv+7iIj/3aqq/92qqv//zMz//8zM///MzP//zMz//8zM///MzP/dqqr/u4iI/7uIiP/dqqr//8zM///MzP/dqqr/Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/3aqq///MzP//zMz/3aqq/7uIiP+7iIj/3aqq///MzP//zMz//8zM///MzP//zMz//8zM/92qqv+7iIj/3aqq/92qqv//zMz/3aqq/2Zm3f9mZt3/Zmbd/4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//Zmbd/2Zm3f9mZt3/3aqq///MzP/dqqr/3aqq/7uIiP/dqqr//8zM///MzP//zMz/3aqq/92qqv/dqqr/3aqq/7uIiP/dqqr//8zM///MzP/dqqr/Zmbd/2Zm3f+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//Zmbd/2Zm3f/dqqr//8zM///MzP/dqqr/u4iI/92qqv/dqqr/3aqq/92qqv+7iIj/u4iI/7uIiP+7iIj/u4iI/92qqv//zMz//8zM/92qqv9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/92qqv//zMz//8zM/92qqv+7iIj/u4iI/7uIiP+7iIj/u4iI///MzP//zMz/3aqq/92qqv+7iIj/3aqq///MzP//zMz//8zM/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr//8zM///MzP//zMz/3aqq/7uIiP/dqqr/3aqq///MzP//zMz//8zM///MzP//zMz/3aqq/7uIiP/dqqr/3aqq///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM/92qqv/dqqr/u4iI/92qqv//zMz//8zM///MzP//zMz//8zM///MzP/dqqr/u4iI/92qqv/dqqr/3aqq/92qqv//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM/92qqv/dqqr/3aqq/92qqv+7iIj/3aqq///MzP//zMz//8zM///MzP//zMz//8zM/92qqv+7iIj/3aqq/92qqv9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/3aqq///MzP//zMz/3aqq/2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f/dqqr/3aqq/7uIiP/dqqr//8zM///MzP//zMz//8zM///MzP/dqqr/3aqq/7uIiP/dqqr/Zmbd//////+IiP//iIj//4iI//+IiP//iIj//4iI//9mZt3/3aqq/92qqv9mZt3//////4iI//+IiP//iIj//4iI//+IiP//Zmbd/2Zm3f/dqqr/u4iI/92qqv/dqqr//8zM///MzP/dqqr/3aqq/92qqv/dqqr/u4iI/92qqv9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f/dqqr/3aqq/2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/92qqv+7iIj/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/92qqv/dqqr/3aqq/7uIiP+7iIj/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv+7iIj/u4iI/92qqv+7iIj/u4iI/92qqv/dqqr/3aqq///MzP//zMz//8zM///MzP//zMz/3aqq/92qqv/dqqr//8zM///MzP//zMz//8zM///MzP//zMz/3aqq/92qqv/dqqr//8zM///MzP//zMz//8zM///MzP/dqqr/3aqq/92qqv+7iIj/u4iI/wAAAAC7iIj/3aqq/92qqv//zMz//8zM///MzP//zMz//8zM///MzP/dqqr/3aqq///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz/3aqq/92qqv//zMz//8zM///MzP//zMz//8zM///MzP/dqqr/3aqq/7uIiP8AAAAAu4iI/92qqv/dqqr//8zM///MzP//zMz//8zM///MzP//zMz/3aqq/92qqv/dqqr//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP/dqqr/3aqq/92qqv//zMz//8zM///MzP//zMz//8zM///MzP/dqqr/3aqq/7uIiP/dqqr/3aqq///MzP//zMz//8zM///MzP//zMz//8zM/92qqv/dqqr/u4iI/92qqv/dqqr//8zM///MzP//zMz//8zM///MzP//zMz/3aqq/92qqv+7iIj/3aqq/92qqv//zMz//8zM///MzP//zMz//8zM///MzP/dqqr/3aqq/92qqv/dqqr//8zM///MzP//zMz//8zM///MzP/dqqr/3aqq/7uIiP8AAAAAu4iI/92qqv/dqqr//8zM///MzP//zMz//8zM/92qqv/dqqr/u4iI/wAAAAC7iIj/3aqq/92qqv//zMz//8zM///MzP//zMz//8zM/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv+7iIj/AAAAAAAAAAAAAAAAu4iI/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAC7iIj/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/w==",
            SHOP_C: "Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/u4iI/wAAAAAAAAAAu4iI/7uIiP/dqqr/3aqq/92qqv/dqqr/u4iI/7uIiP/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv+7iIj/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr/u4iI/7uIiP8AAAAAAAAAAAAAAAAAAAAA3aqq/92qqv/dqqr/u4iI/wAAAAC7iIj/3aqq/92qqv/dqqr/3aqq/92qqv+7iIj/u4iI/92qqv/dqqr//8zM///MzP/dqqr/3aqq/7uIiP+7iIj/3aqq///MzP//zMz//8zM/92qqv/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/92qqv/dqqr/u4iI/7uIiP/dqqr/3aqq///MzP//zMz/3aqq/7uIiP+7iIj/3aqq///MzP//zMz//8zM///MzP/dqqr/u4iI/7uIiP/dqqr//8zM///MzP//zMz//8zM/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAN2qqv+7iIj/3aqq/92qqv/dqqr/u4iI/92qqv/dqqr//8zM///MzP/dqqr/u4iI/7uIiP/dqqr//8zM///MzP//zMz//8zM/92qqv+7iIj/u4iI/92qqv//zMz//8zM///MzP//zMz/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAA3aqq/92qqv+7iIj/3aqq/92qqv+7iIj/3aqq/92qqv//zMz//8zM/92qqv+7iIj/u4iI/92qqv//zMz//8zM///MzP//zMz/3aqq/7uIiP+7iIj/3aqq///MzP//zMz//8zM///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAD/zMz/3aqq/7uIiP/dqqr/3aqq/7uIiP/dqqr/3aqq///MzP//zMz//8zM/92qqv/dqqr//8zM///MzP//zMz//8zM///MzP//zMz/3aqq/92qqv//zMz//8zM///MzP//zMz//8zM/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAN2qqv/dqqr/u4iI/7uIiP+7iIj/u4iI/92qqv/dqqr/3aqq///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAu4iI/7uIiP+7iIj/3aqq/92qqv+7iIj/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv+7iIj/u4iI/wAAAAAAAAAAAAAAAAAAAADdqqr/3aqq/7uIiP//zMz//8zM/92qqv+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAP/MzP/dqqr/u4iI/7uIiP/dqqr/3aqq/92qqv+7iIj/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/8zM/92qqv+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr//8zM///MzP//zMz//8zM///MzP//zMz//8zM/92qqv/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/zMz/3aqq/7uIiP/dqqr/u4iI/7uIiP/dqqr/3aqq/92qqv+7iIj/u4iI/92qqv/dqqr/3aqq/92qqv//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM/92qqv/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAP/MzP/dqqr/u4iI/92qqv/dqqr/u4iI/7uIiP//zMz//8zM/92qqv+7iIj/u4iI/92qqv/dqqr/3aqq///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM/92qqv/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAA3aqq/92qqv+7iIj/3aqq/92qqv/dqqr/u4iI/7uIiP/dqqr/3aqq/92qqv+7iIj/u4iI/92qqv/dqqr/3aqq///MzP///////8zM///MzP//zMz//8zM///MzP//zMz//8zM/92qqv/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAC7iIj/u4iI/7uIiP/dqqr/3aqq/92qqv/dqqr/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/92qqv/dqqr/3aqq///////////////////MzP//zMz//8zM///MzP//zMz//8zM/92qqv/dqqr/3aqq/7uIiP8AAAAAAAAAAN2qqv/dqqr/u4iI/92qqv//zMz//8zM/92qqv/dqqr/u4iI/7uIiP/dqqr/3aqq/92qqv+7iIj/u4iI/92qqv/dqqr/3aqq///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz/3aqq/92qqv/dqqr/3aqq/7uIiP8AAAAA/8zM/92qqv+7iIj/3aqq///MzP//zMz//8zM/92qqv/dqqr/u4iI/7uIiP//zMz//8zM/92qqv+7iIj/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/7uIiP//zMz/3aqq/7uIiP/dqqr//8zM///MzP//zMz//8zM/92qqv/dqqr/u4iI/7uIiP/dqqr/3aqq/92qqv+7iIj/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/u4iI///MzP/dqqr/u4iI/92qqv//zMz//8zM///MzP//zMz/3aqq/7uIiP8AAAAAu4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/3aqq/92qqv+7iIj/3aqq///MzP//zMz//8zM///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADdqqr/3aqq/7uIiP/dqqr//8zM///MzP//zMz//8zM/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN2qqv/dqqr/u4iI/92qqv/dqqr//8zM///MzP/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3aqq/92qqv+7iIj/3aqq/92qqv/dqqr/3aqq/92qqv+7iIj/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN2qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            LAVA: "Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAZGTY/2lp3f9iYtb/amre/2pq3v9hYdX/amre/2Rk2P9mZtr/Zmba/2Zm2v9mZtr/Zmba/2Zm2v9mZtr/Zmba/2Zm3P9mZtz/Zmbc/2Zm3P9mZtz/Zmbc/2Zm3P9mZtz/aGje/2Ji2P9qauD/amrg/2Nj2f9mZtz/aGje/2Zm3P9nZ9v/g4P3/3Fx5f+Jif3/Y2PX/25u4v9kZNj/amre/2Zm2v9nZ9v/aGjc/2lp3f9pad3/aGjc/2dn2/9mZtr/Zmbc/2Zm3P9mZtz/Zmbc/2Zm3P9mZtz/Zmbc/2Zm3P9iYtj/bm7k/2Ji2P9pad//Zmbc/21t4/9nZ93/Zmbc/25u4v+Jif3/goL2/4iI/P9pad3/aWnd/2Vl2f9nZ9v/Z2fb/2dn2/9lZdn/ZGTY/2Rk2P9lZdn/Z2fb/2dn2/9nZ93/Z2fd/2dn3f9nZ93/Z2fd/2dn3f9nZ93/Z2fd/29v5f9fX9X/aGje/21t4/9iYtj/iIj+/2ho3v9kZNr/X1/T/2dn2/9tbeH/ZGTY/2lp3f9eXtL/amre/2Nj1/9sbOD/ZWXZ/2Rk2P9sbOD/bGzg/2Rk2P9lZdn/bGzg/2dn3f9nZ93/Z2fd/2dn3f9nZ93/Z2fd/2dn3f9nZ93/h4f9/2dn3f9oaN7/ZGTa/2Fh1/+MjP//aGje/2lp3/9oaNz/ZWXZ/2Nj1/9kZNj/a2vf/2ho3P9sbOD/aGjc/2Ji1v9mZtr/aGjc/2Zm2v9mZtr/aGjc/2Zm2v9iYtb/Z2fd/2dn3f9nZ93/Z2fd/2dn3f9nZ93/Z2fd/2dn3f+Jif//jIz//2dn3f9ubuT/jY3//4iI/v9oaN7/YmLY/2tr3/9mZtr/ZGTY/2Zm2v9mZtr/ZGTY/2Ji1v9iYtb/amre/2dn2/9mZtr/Zmba/2Zm2v9mZtr/Z2fb/2pq3v9nZ93/Z2fd/2dn3f9nZ93/Z2fd/2dn3f9nZ93/Z2fd/2Zm3P+Ghvz/hob8/4WF+/+IiP7/aGje/2Fh1/9vb+X/Y2PX/2Rk2P9qat7/Z2fb/2pq3v9pad3/a2vf/2xs4P9jY9f/i4v//4yM//9kZNj/ZGTY/4yM//+Li///Y2PX/2dn3f9nZ93/Z2fd/2dn3f9nZ93/Z2fd/2dn3f9nZ93/bm7k/2Nj2f9ra+H/ZWXb/2ho3v9oaN7/Zmbc/2Vl2/9jY9f/a2vf/2ho3P9pad3/X1/T/2xs4P9lZdn/Z2fb/2pq3v+Cgvb/jo7//4eH+/+Hh/v/jo7//4KC9v9qat7/Z2fd/2dn3f9nZ93/Z2fd/2dn3f9nZ93/Z2fd/2dn3f9jY9n/bGzi/2Nj2f9lZdv/aWnf/2Rk2v9sbOL/ZWXb/2lp3f9jY9f/Zmba/2tr3/9pad3/ZGTY/3Bw5P9jY9f/aGjc/2Vl2f+Li///iYn9/4mJ/f+Li///ZWXZ/2ho3P9oaN7/Y2PZ/2xs4v9nZ93/Z2fd/2xs4v9kZNr/aWnf/2Vl2/9nZ93/aGje/2ho3v9mZtz/Zmbc/2Zm3P9nZ93/X1/T/21t4f9nZ9v/YmLW/2Zm2v9iYtb/Z2fb/2dn2/9pad3/YmLW/2tr3/9kZNj/ZGTY/2tr3/9iYtb/aWnd/2ho3v9nZ93/Zmbc/2Vl2/9mZtz/Zmbc/2ho3v9pad//Zmbc/2dn3f9nZ93/Z2fd/2dn3f9mZtz/Z2fd/2dn3f9qat7/Z2fb/2Rk2P9tbeH/amre/2Rk2P9oaNz/a2vf/2Rk2P9nZ9v/ZGTY/2dn2/9nZ9v/ZGTY/2dn2/9kZNj/ZWXb/2tr4f9kZNr/aWnf/2lp3/9kZNr/a2vh/2Zm3P9nZ93/Z2fd/2Zm3P9nZ93/Z2fd/2dn3f9nZ93/Zmbc/2Fh1f9sbOD/Zmba/2Rk2P9nZ9v/aGjc/2Rk2P9nZ9v/Z2fb/2tr3/9lZdn/aGjc/2ho3P9lZdn/a2vf/2dn2/9jY9n/aGje/2Ji2P9nZ93/Z2fd/2Ji2P9pad//ZGTa/2dn3f9mZtz/Zmbc/2Zm3P9oaN7/aGje/2dn3f9lZdv/aGjc/2Ji1v9ra9//bW3h/2Nj1/9jY9f/aWnd/2lp3f9oaNz/Zmba/2Zm2v9kZNj/ZGTY/2Zm2v9mZtr/aGjc/2ho3v9oaN7/Z2fd/2dn3f9nZ93/Z2fd/2ho3v9pad//Z2fd/2Zm3P9mZtz/Zmbc/2ho3v9oaN7/Z2fd/2Vl2/9qat7/ZWXZ/2pq3v9jY9f/bGzg/2pq3v9mZtr/YmLW/2Vl2f9kZNj/a2vf/2pq3v9qat7/a2vf/2Rk2P9lZdn/ZGTa/2Vl2/9oaN7/aWnf/2lp3/9oaN7/ZWXb/2Rk2v9nZ93/Z2fd/2Zm3P9nZ93/Z2fd/2dn3f9nZ93/Zmbc/2Nj1/+MjP//h4f7/2Bg1P+Li///h4f7/2lp3f9oaNz/aWnd/2Zm2v9nZ9v/ZGTY/2Rk2P9nZ9v/Zmba/2lp3f9oaN7/a2vh/2Ji2P9lZdv/Zmbc/2Nj2f9sbOL/aWnf/2Zm3P9nZ93/Z2fd/2dn3f9nZ93/Zmbc/2dn3f9nZ93/aWnd/2Ji1v+MjP//i4v//4WF+f9lZdn/Zmba/2Vl2f9mZtr/aWnd/2dn2/9pad3/aWnd/2dn2/9pad3/Zmba/4eH/f+Hh/3/aGje/2dn3f9nZ93/aGje/4eH/f+IiP7/ZWXb/2dn3f9oaN7/aGje/2Zm3P9mZtz/Zmbc/2dn3f9pad//Zmbc/2Zm3P9nZ93/Z2fd/2lp3/9qauD/Z2fd/2Vl2/9nZ93/Z2fd/2Vl2/9lZdv/aGje/2dn3f9lZdv/ZWXb/4eH/f+Li///iIj+/4iI/v+MjP//iYn//2ho3v9pad//amrg/2Zm3P9pad//aGje/2Zm3P9qauD/Y2PZ/2Nj2f9mZtz/aWnf/2lp3/9mZtz/ZGTa/2Nj2f9kZNr/Z2fd/2tr4f9pad//aWnf/2Nj2f9mZtz/Zmbc/2lp3/9pad//ZWXb/4yM//+Li///ior//4qK//9hYdf/Y2PZ/1xc0v9tbeP/bGzi/1xc0v9lZdv/bm7k/2Vl2/9pad//aGje/2lp3/9nZ93/Zmbc/2lp3/9pad//Z2fd/2lp3/9oaN7/Z2fd/2Nj2f9oaN7/ZWXb/2lp3/9mZtz/Z2fd/2ho3v9hYdf/aGje/2Ji2P9kZNr/bGzi/2Zm3P9tbeP/Zmbc/2pq4P9jY9n/b2/l/3Fx5/9hYdf/Y2PZ/2Zm3P9mZtz/Z2fd/2Rk2v9jY9n/Zmbc/2dn3f9mZtz/aWnf/2tr4f9nZ93/aGje/2lp3/9sbOL/aWnf/2lp3/9oaN7/YmLY/3Fx5/9lZdv/aGje/2Zm3P9iYtj/b2/l/2Ji2P9vb+X/X1/V/2pq4P9iYtj/X1/V/21t4/9nZ93/Z2fd/2Nj2f9oaN7/amrg/2pq4P9nZ93/ZGTa/2Rk2v9mZtz/Zmbc/2Nj2f9qauD/YmLY/2ho3v9eXtT/Zmbc/2Zm3P9mZtz/YGDW/2pq4P9sbOL/aWnf/2Rk2v9gYNb/bW3j/2Rk2v9qauD/ZWXb/2ho3v9qauD/Z2fd/2xs4v9mZtz/amrg/2Vl2/9lZdv/aGje/2dn3f9pad//a2vh/2Zm3P9ra+H/Zmbc/2lp3/9hYdf/bGzi/2lp3/9ubuT/aWnf/3Nz6f9hYdf/amrg/2Zm3P9kZNr/a2vh/2tr4f+Ghvz/i4v//2Ji2P+IiP7/ior//2Ji2P9oaN7/a2vh/2Fh1/9pad//YWHX/2dn3f9ra+H/ZGTa/2dn3f9ra+H/Y2PZ/2Rk2v9oaN7/aGje/2Zm3P9lZdv/aGje/2Vl2/9gYNb/YmLY/2Zm3P9qauD/amrg/2ho3v9mZtz/ZWXb/2Rk2v+Fhfv/kJD//4SE+v9pad//ZWXb/2lp3/9lZdv/amrg/2Rk2v9sbOL/hob8/4mJ//9sbOL/YmLY/2pq4P9lZdv/amrg/4SE+v+Li///iIj+/2pq4P9qauD/ZGTa/2tr4f9oaN7/Zmbc/2dn3f9jY9n/ZGTa/2lp3/9oaN7/aGje/2pq4P9gYNb/a2vh/2Vl2/9kZNr/bm7k/2Rk2v9mZtz/Y2PZ/2lp3/9mZtz/iIj+/4qK//9mZtz/Z2fd/2Vl2/+Rkf//fn70/2tr4f9lZdv/Zmbc/2Zm3P9mZtz/Zmbc/2ho3v9jY9n/Z2fd/2Zm3P9mZtz/aWnf/2Rk2v9oaN7/Z2fd/2dn3f9lZdv/ZWXb/2lp3/9nZ93/aWnf/2Rk2v9mZtz/amrg/2Zm3P+Dg/n/k5P//4iI/v+Njf//ior//3198/9xcef/Zmbc/2Rk2v9mZtz/Z2fd/2dn3f9oaN7/Zmbc/2pq4P9nZ93/aWnf/2tr4f9jY9n/aWnf/2Nj2f9oaN7/Zmbc/2tr4f9lZdv/ZWXb/2lp3/9lZdv/aGje/2Zm3P9pad//ZWXb/3Bw5v+Bgff/h4f9/4qK//+Hh/3/amrg/2Zm3P9kZNr/Zmbc/2dn3f9nZ93/Z2fd/2lp3/9jY9n/ZWXb/2pq4P9iYtj/aGje/2Rk2v9ra+H/Zmbc/2dn3f9qauD/aGje/2Zm3P9lZdv/ZWXb/2ho3v9mZtz/ZGTa/2ho3v9oaN7/Y2PZ/2Zm3P9ra+H/aGje/2ho3v9mZtz/ZWXb/2Zm3P9oaN7/aWnf/2dn3f9mZtz/Zmbc/4OD+f91dev/hob8/2Vl2/9nZ93/amrg/2Ji2P9oaN7/ZWXb/2tr4f9jY9n/aWnf/2lp3/9qauD/a2vh/2Nj2f9lZdv/aGje/2tr4f9lZdv/ZGTa/2Vl2/9hYdf/ZWXb/2ho3v9nZ93/Z2fd/2ho3v9pad//Z2fd/2Zm3P9mZtz/ior//3t78f+Jif//Z2fd/2dn3f9qauD/YWHX/2ho3v9oaN7/Y2PZ/2Zm3P9ubuT/aGje/4WF+/9lZdv/amrg/2dn3f9mZtz/Z2fd/2Zm3P9pad//amrg/2dn3f9ra+H/aGje/2Zm3P9lZdv/Zmbc/2dn3f9oaN7/aGje/2dn3f9pad//amrg/2tr4f9iYtj/Z2fd/2Rk2v9sbOL/aWnf/2dn3f9nZ93/aGje/2Fh1/+Jif//aWnf/4eH/f9iYtj/Z2fd/2ho3v9jY9n/ZGTa/2ho3v9mZtz/Zmbc/2ho3v9mZtz/Zmbc/2Zm3P9mZtz/Zmbc/2dn3f9oaN7/aGje/2Nj2f9nZ93/Y2PZ/2Zm3P9pad//Y2PZ/2tr4f9mZtz/amrg/2Ji2P9ra+H/aWnf/2lp3/+Cgvj/aGje/2tr4f9lZdv/bGzi/2ho3v9oaN7/aGje/2Rk2v9nZ93/aGje/2Zm3P9oaN7/aWnf/2dn3f9mZtz/ZWXb/2Zm3P9nZ93/aWnf/2Vl2/9oaN7/Z2fd/2dn3f9pad//ZGTa/2ho3v9lZdv/bGzi/2Fh1/9mZtz/ZWXb/2pq4P9ra+H/YmLY/w==",
            VOID: "Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/3aqq/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP/dqqr/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/3aqq///MzP/dqqr/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/3aqq/92qqv//zMz/srLs///MzP/dqqr/3aqq/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/92qqv//zMz/3aqq/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/92qqv8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/3aqq/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP/dqqr/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/3aqq/7Ky7f/dqqr/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/3aqq/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/3aqq/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP/dqqr/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP/dqqr/3aqq/7Ky7f/dqqr/3aqq/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/3aqq/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP/dqqr/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/wAAAP8AAAD/AAAA/w==",
            NPC002: "Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmiLv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGaIu/9miLv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZoi7/2aIu/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmiLv/Zoi7/2aIu/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGaIu/+Iqt3/Zoi7/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZoi7/4iq3f9miLv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmiLv/iKrd/2aIu/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGaIu/+Iqt3/Zoi7/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZoi7/4iq3f9miLv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGaIu/9miLv/qsz//2aIu/9miLv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/u4iI/7uIiP8AAAAAZoi7/2aIu/8AAAAAZoi7/4iq3f+qzP//iKrd/2aIu/8AAAAAZoi7/2aIu/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv//zMz//8zM/7uIiP8AAAAAZoi7/2aIu/9miLv/qsz//6rM//+Iqt3/Zoi7/2aIu/9miLv/AAAAAAAAAAC7iIj/u4iI/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/u4iI/92qqv/dqqr/3aqq/7uIiP9ERET/Zoi7/4iq3f+qzP//qsz//4iq3f+Iqt3/Zoi7/wAAAAAAAAAAu4iI///MzP//zMz/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/7uIiP+7iIj/u4iI/7uIiP9miLv/Zoi7/4iq3f+Iqt3/iKrd/2aIu/9miLv/u4iI/7uIiP/dqqr/3aqq/92qqv/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/2Zm3f9miLv/Zoi7/4iq3f9miLv/Zoi7/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj//8zM///MzP//zMz/3aqq/92qqv+7iIj/Zmbd/2Zm3f8iRHf/Zoi7/yJEd/9mZt3/Zmbd/7uIiP/dqqr/3aqq/7uIiP+7iIj/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv//zMz//8zM///MzP+7iIj/u4iI/wAAAABmZt3/IkR3/2aIu/9miLv/Zoi7/yJEd/9mZt3/Zmbd/7uIiP+7iIj//8zM///MzP//zMz/u4iI/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/92qqv+7iIj/u4iI/wAAAAAAAAAAAAAAAGZm3f9miLv/iKrd/6rM//+Iqt3/Zoi7/2Zm3f9mZt3/Zmbd/7uIiP/dqqr//8zM///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAZmbd/2aIu/8iRHf/qsz//yJEd/9miLv/Zmbd/2Zm3f9mZt3/AAAAALuIiP/dqqr/3aqq/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmZt3/Zmbd/4iq3f9mZt3/iKrd/2Zm3f+IiP//Zmbd/wAAAAAAAAAAAAAAALuIiP+7iIj/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmZt3/Zmbd/4iI//9mZt3/Zmbd/4iI//9mZt3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGZm3f9mZt3/iIj//4iI//+IiP//Zmbd/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGZm3f9mZt3/Zmbd/2Zm3f8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            TRANSPORT_UP : "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",
            TRANSPORT_DOWN : "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AAAAAAAAiIiI/8TExP/Dw8P/s7Oz/4GBgf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAc3Nz/3Z2dv9zc3P/c3Nz/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            BAT_LOW : "Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP/dqqr/3aqq/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv//zMz/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP/dqqr/3aqq///MzP/dqqr/u4iI/wAAAAAAAAAAu4iI/7uIiP8AAAAAAAAAALuIiP/dqqr//8zM/92qqv/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/92qqv//zMz/3aqq///MzP/dqqr/u4iI/7uIiP/dqqr/3aqq/7uIiP+7iIj/3aqq///MzP/dqqr//8zM/92qqv/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP/dqqr//8zM/92qqv//zMz/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq///MzP/dqqr//8zM/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv/dqqr//8zM///MzP//zMz//8zM/92qqv/dqqr//8zM///MzP/dqqr/3aqq///MzP//zMz//8zM///MzP/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq///MzP/dqqr//8zM///MzP//zMz/3aqq///MzP//zMz//8zM///MzP/dqqr//8zM///MzP//zMz/3aqq///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP/dqqr/3aqq///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz/3aqq/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv//zMz//8zM///MzP//zMz//8zM/2Zm3f9mZt3//8zM///MzP9mZt3/Zmbd///MzP//zMz//8zM///MzP//zMz/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq///MzP//zMz//8zM///MzP/dqqr//////2Zm3f//zMz//8zM//////9mZt3/3aqq///MzP//zMz//8zM/92qqv/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq///MzP//zMz/3aqq/7uIiP+7iIj/3aqq///MzP//zMz/3aqq/7uIiP+7iIj/3aqq///MzP//zMz/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP/dqqr//8zM/92qqv+7iIj/AAAAALuIiP/dqqr/3aqq/92qqv/dqqr/u4iI/wAAAAC7iIj/3aqq///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv/dqqr/u4iI/wAAAAAAAAAAAAAAALuIiP+7iIj/u4iI/7uIiP8AAAAAAAAAAAAAAAC7iIj/3aqq/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/7uIiP8AAAAAAAAAAAAAAAAAAAAAu4iI/wAAAAAAAAAAu4iI/wAAAAAAAAAAAAAAAAAAAAC7iIj/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            MASTER_LOW : "Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/2ZmZv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/u4iI/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq///MzP/dqqr//8zM/92qqv//zMz/3aqq///MzP/dqqr/3aqq/92qqv/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/92qqv/dqqr//8zM///MzP//zMz//8zM///MzP//zMz//8zM/92qqv//zMz/3aqq///MzP/dqqr/3aqq/92qqv/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/92qqv/dqqr//8zM///MzP//zMz//8zM///MzP//zMz//8zM/92qqv//zMz/3aqq/92qqv/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/u4iI/92qqv/dqqr//8zM///MzP//zMz//8zM///MzP//zMz//8zM/92qqv/dqqr/3aqq/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv/dqqr//8zM///MzP//zMz//8zM///MzP//zMz//8zM/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv//zMz//8zM///MzP//zMz//8zM///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/92qqv//zMz//8zM///MzP//zMz/3aqq/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq///MzP//zMz//8zM///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP/dqqr/3aqq///MzP//zMz/3aqq/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/7uIiP+7iIj/u4iI/7uIiP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/u4iI/wAAAAAAAAAAAAAAALuIiP+7iIj/u4iI/92qqv+7iIj/u4iI/wAAAAAAAAAAAAAAAAAAAAC7iIj/u4iI/92qqv/dqqr/u4iI/7uIiP/dqqr/3aqq/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/3aqq/7uIiP+7iIj/u4iI/wAAAAAAAAAAu4iI/2ZmZv+7iIj/u4iI/92qqv/dqqr/u4iI/7uIiP+7iIj/u4iI/7uIiP/dqqr/3aqq///MzP+7iIj/u4iI///MzP/dqqr/3aqq/7uIiP+7iIj/u4iI/7uIiP+7iIj/3aqq/92qqv+7iIj/u4iI/2ZmZv+7iIj/AAAAAAAAAAC7iIj/ZmZm/2ZmZv+7iIj/3aqq///MzP/dqqr/3aqq/7uIiP+7iIj/3aqq/92qqv+7iIj/u4iI/92qqv/dqqr/u4iI/7uIiP/dqqr/3aqq/7uIiP+7iIj/3aqq/92qqv//zMz/3aqq/7uIiP9mZmb/ZmZm/7uIiP8AAAAAAAAAALuIiP9mZmb/ZmZm/7uIiP/dqqr//8zM///MzP//zMz/u4iI/92qqv//zMz//8zM/92qqv/dqqr/u4iI/7uIiP/dqqr/3aqq///MzP//zMz/3aqq/7uIiP/dqqr//8zM///MzP/dqqr/u4iI/2ZmZv9mZmb/u4iI/wAAAAAAAAAAiKrd/4iq3f9mZmb/u4iI/92qqv//zMz//8zM/92qqv+7iIj/3aqq///MzP/dqqr/3aqq/7uIiP+7iIj/u4iI/7uIiP/dqqr/3aqq/92qqv/dqqr/u4iI/92qqv/dqqr//8zM/92qqv+7iIj/ZmZm/4iq3f+Iqt3/AAAAAAAAAACIqt3/qsz//2ZmZv+7iIj/3aqq///MzP//zMz/u4iI/7uIiP/dqqr/3aqq/7uIiP+7iIj/RERE/0RERP9ERET/RERE/7uIiP+7iIj/3aqq/92qqv+7iIj/u4iI/92qqv//zMz/3aqq/7uIiP9mZmb/qsz//4iq3f8AAAAAAAAAAIiq3f+qzP//u4iI/92qqv/dqqr/3aqq/92qqv+7iIj/3aqq/92qqv+7iIj/3aqq/0RERP9ERET/RERE/0RERP9ERET/RERE/92qqv+7iIj/3aqq/92qqv+7iIj/3aqq/92qqv/dqqr/3aqq/7uIiP+qzP//iKrd/wAAAAAAAAAAu4iI/7uIiP/dqqr/3aqq/92qqv+7iIj/u4iI/7uIiP/dqqr/u4iI/92qqv9ERET/RERE/0RERP9ERET/RERE/0RERP9ERET/RERE/92qqv+7iIj/3aqq/7uIiP+7iIj/u4iI/7uIiP/dqqr/3aqq/7uIiP+7iIj/AAAAAAAAAAAAAAAAu4iI/7uIiP+7iIj/u4iI/7uIiP9mZmb/u4iI/7uIiP/dqqr/3aqq/0RERP9ERET/RERE/0RERP9ERET/RERE/0RERP9ERET/3aqq/92qqv+7iIj/u4iI/0RERP9mZmb/u4iI/7uIiP+7iIj/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI///MzP/dqqr/RERE/4iI//+IiP//RERE/0RERP+IiP//iIj//0RERP/dqqr//8zM/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj//8zM/92qqv9ERET//////4iI//9ERET/RERE//////+IiP//RERE/92qqv//zMz/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj//8zM/92qqv9ERET/RERE/0RERP9ERET/RERE/0RERP/dqqr//8zM/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP/dqqr//8zM/92qqv9ERET/RERE/0RERP9ERET/3aqq///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/RERE/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            SLM_RED : "Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARGaZ/0Rmmf9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f9EZpn/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERmmf9mZt3/Zmbd/2Zm3f9mZt3/iIj//2Zm3f+IiP//Zmbd/4iI//9mZt3/Zmbd/2Zm3f9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/2Zm3f+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//Zmbd/4iI//9mZt3/iIj//2Zm3f9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARGaZ/2Zm3f9mZt3/iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//Zmbd/4iI//9mZt3/iIj//2Zm3f9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//2Zm3f+IiP//Zmbd/4iI//9mZt3/iIj//2Zm3f9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARGaZ/2Zm3f9mZt3/iIj//4iI///MzMz/zMzM/8zMzP+IiP//iIj//4iI//+IiP//iIj//8zMzP/MzMz/zMzM/4iI//9mZt3/Zmbd/2Zm3f9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/4iI//+IiP//zMzM/////////////////8zMzP+IiP//iIj//4iI///MzMz/////////////////zMzM/4iI//9mZt3/Zmbd/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERmmf9mZt3/iIj//8zMzP//////RERE/0RERP9ERET//////8zMzP+IiP//zMzM//////9ERET/RERE/0RERP//////zMzM/4iI//9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARGaZ/2Zm3f+IiP//zMzM//////9ERET//////0RERP//////zMzM/4iI///MzMz//////0RERP//////RERE///////MzMz/Zmbd/2Zm3f9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/2Zm3f/MzMz//////0RERP9ERET/RERE///////MzMz/iIj//8zMzP//////RERE/0RERP9ERET//////8zMzP9mZt3/Zmbd/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/2Zm3f/MzMz/////////////////zMzM/4iI//+IiP//iIj//8zMzP/////////////////MzMz/iIj//2Zm3f9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERmmf9mZt3/Zmbd/2Zm3f/MzMz/zMzM/8zMzP+IiP//iIj//4iI//+IiP//iIj//8zMzP/MzMz/zMzM/4iI//9mZt3/Zmbd/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERmmf9mZt3/Zmbd/4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//2Zm3f+IiP//Zmbd/2Zm3f9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERmmf9mZt3/Zmbd/4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//9mZt3/iIj//2Zm3f9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERmmf9mZt3/Zmbd/2Zm3f+IiP//iIj//4iI//+IiP//Zmbd/2Zm3f9mZt3/Zmbd/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERmmf9EZpn/Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/0Rmmf9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            SKELETON : "Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMzMzP/MzMz/zMzM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMzMzP/MzMz/zMzM/8zMzP/MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAADMzMz/zMzM/////////////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMzMzP///////////8zMzP/MzMz/AAAAAAAAAAAAAAAAAAAAAMzMzP/MzMz/ZmZm/8zMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMzMzP9mZmb/zMzM/8zMzP8AAAAAAAAAAAAAAAAAAAAAzMzM///////MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMzMzP//////zMzM/wAAAAAAAAAAAAAAAAAAAADMzMz//////8zMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzMzM///////MzMz/AAAAAAAAAAAAAAAAAAAAAMzMzP//////zMzM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMzMz/zMzM/8zMzP8AAAAAAAAAAAAAAAAAAAAAzMzM/8zMzP/MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMzMzP9mZmb/ZmZm/2ZmZv9mZmb/ZmZm/2ZmZv9mZmb/ZmZm/8zMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMzMzP/MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMzMz/zMzM/2ZmZv9mZmb/zMzM/8zMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMzMzP/MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAADMzMz////////////MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAABmZmb/ZmZm/2ZmZv/MzMz/ZmZm/2ZmZv/MzMz/ZmZm/2ZmZv9mZmb/AAAAAAAAAAAAAAAAAAAAAAAAAADMzMz////////////MzMz/AAAAAAAAAAAAAAAAAAAAAMzMzP//////zMzM/8zMzP8AAAAAAAAAAAAAAAAAAAAAZmZm/8zMzP/MzMz/zMzM/2ZmZv/MzMz/zMzM/2ZmZv/MzMz/zMzM/8zMzP9mZmb/AAAAAAAAAAAAAAAAAAAAAMzMzP/MzMz//////8zMzP8AAAAAAAAAAAAAAAAAAAAAZmZm/8zMzP/MzMz/AAAAAAAAAAAAAAAAAAAAAGZmZv9mZmb/ZmZm/2ZmZv9mZmb/ZmZm/8zMzP/MzMz/ZmZm/2ZmZv9mZmb/ZmZm/2ZmZv9mZmb/AAAAAAAAAAAAAAAAAAAAAMzMzP/MzMz/ZmZm/wAAAAAAAAAAAAAAAAAAAADMzMz//////wAAAAAAAAAAAAAAAAAAAAAAAAAAZmZm/////////////////8zMzP9mZmb///////////9mZmb/zMzM/////////////////2ZmZv8AAAAAAAAAAAAAAAAAAAAAAAAAAP/////MzMz/AAAAAAAAAAAAAAAAAAAAAMzMzP//////AAAAAAAAAAAAAAAAAAAAAAAAAADMzMz/ZmZm/2ZmZv9mZmb/ZmZm/2ZmZv/MzMz/zMzM/2ZmZv9mZmb/ZmZm/2ZmZv9mZmb/zMzM/wAAAAAAAAAAAAAAAAAAAAAAAAAA/////8zMzP8AAAAAAAAAAAAAAAAAAAAAzMzM//////8AAAAAAAAAAAAAAAAAAAAAAAAAAGZmZv/////////////////MzMz/ZmZm////////////ZmZm/8zMzP////////////////9mZmb/AAAAAAAAAAAAAAAAAAAAAAAAAAD/////zMzM/wAAAAAAAAAAAAAAAAAAAADMzMz//////wAAAAAAAAAAAAAAAAAAAAAAAAAAzMzM//////9mZmb/ZmZm/2ZmZv9mZmb/zMzM/8zMzP9mZmb/ZmZm/2ZmZv9mZmb//////8zMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAP/////MzMz/AAAAAAAAAAAAAAAAAAAAAMzMzP//////AAAAAAAAAAAAAAAAAAAAAAAAAADMzMz/ZmZm////////////zMzM/2ZmZv9mZmb/ZmZm/2ZmZv/MzMz///////////9mZmb/zMzM/wAAAAAAAAAAAAAAAAAAAAAAAAAA/////8zMzP8AAAAAAAAAAAAAAAAAAAAAzMzM//////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMzMz//////2ZmZv9mZmb/zMzM/8zMzP/MzMz/zMzM/2ZmZv9mZmb//////8zMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////zMzM/wAAAAAAAAAAAAAAAAAAAADMzMz/zMzM/8zMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAMzMzP9mZmb/ZmZm/8zMzP/MzMz////////////MzMz/zMzM/2ZmZv9mZmb/zMzM/wAAAAAAAAAAAAAAAAAAAAAAAAAAzMzM/8zMzP/MzMz/AAAAAAAAAAAAAAAAAAAAAMzMzP/MzMz/zMzM/8zMzP8AAAAAAAAAAAAAAAAAAAAAZmZm/2ZmZv/MzMz/zMzM/2ZmZv9mZmb/ZmZm/2ZmZv/MzMz/zMzM/2ZmZv9mZmb/AAAAAAAAAAAAAAAAAAAAAMzMzP/MzMz/zMzM/8zMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAMzMzP///////////8zMzP///////////8zMzP/MzMz/ZmZm/8zMzP9mZmb/ZmZm/2ZmZv9mZmb/ZmZm/2ZmZv/MzMz/ZmZm/8zMzP/MzMz////////////MzMz////////////MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzMzM////////////zMzM/8zMzP/MzMz/RERE/0RERP9mZmb/zMzM/2ZmZv/MzMz////////////MzMz/ZmZm/8zMzP9mZmb/ZmZm/0RERP/MzMz/zMzM/8zMzP///////////8zMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzMzM/8zMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAGZmZv9mZmb/zMzM///////MzMz/zMzM///////MzMz/ZmZm/2ZmZv8AAAAAAAAAAAAAAAAAAAAAAAAAAMzMzP/MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMzMz/zMzM////////////ZmZm/2ZmZv9mZmb/ZmZm////////////zMzM/8zMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzMzM/8zMzP//////////////////////ZmZm/2ZmZv//////////////////////zMzM/8zMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMzMz//////2ZmZv9mZmb/ZmZm//////////////////////9mZmb/ZmZm/2ZmZv//////zMzM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMzMzP//////ZmZm/2ZmZv9mZmb/ZmZm////////////ZmZm/2ZmZv9mZmb/ZmZm///////MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzMzM/8zMzP9mZmb/ZmZm/2ZmZv9mZmb///////////9mZmb/ZmZm/2ZmZv9mZmb/zMzM/8zMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzMzM//////9mZmb/ZmZm/2ZmZv///////////2ZmZv9mZmb/ZmZm///////MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMzMz/zMzM////////////////////////////////////////////zMzM/8zMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMzMz/zMzM/8zMzP//////////////////////zMzM/8zMzP/MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzMzM/8zMzP/MzMz/zMzM/8zMzP/MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            SKELETON_BLUE : "Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMzMz/zMzM/8zMzP//////zMzM/8zMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMzMz/zMzM/8zMzP/MzMz/zMzM/wAAAAAAAAAAAAAAAAAAAAAAAAAAzMzM/8zMzP/////////////////MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMzMz////////////MzMz/zMzM/wAAAAAAAAAAAAAAAAAAAADMzMz/zMzM/2ZmZv/MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMzMz/ZmZm/8zMzP/MzMz/AAAAAAAAAAAAAAAAAAAAAMzMzP//////zMzM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMzMz//////8zMzP8AAAAAAAAAAAAAAAAAAAAAzMzM///////MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMzMzP//////zMzM/wAAAAAAAAAAAAAAAAAAAADMzMz//////8zMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzMzM/8zMzP/MzMz/AAAAAAAAAAAAAAAAAAAAAMzMzP/MzMz/zMzM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMzMz/ZmZm/2ZmZv9mZmb/ZmZm/2ZmZv9mZmb/ZmZm/2ZmZv/MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzMzM/8zMzP9mZmb/ZmZm/8zMzP/MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZmZm/2ZmZv9mZmb/zMzM/2ZmZv9mZmb/zMzM/2ZmZv9mZmb/ZmZm/2ZmZv9mZmb/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMzMz/zMzM/wAAAAAAAAAAAAAAAGZmZv/MzMz/zMzM/8zMzP9mZmb/zMzM/8zMzP9mZmb/zMzM/8zMzP9mZmb/ZmZm/7uIiP+7iIj//8zM///MzP//zMz//8zM/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/u4iI/0RERP+7iIj/u4iI/wAAAABmZmb/ZmZm/2ZmZv9mZmb/ZmZm/2ZmZv/MzMz/zMzM/2ZmZv9mZmb/ZmZm/2ZmZv+7iIj/u4iI///MzP9mZmb//8zM///MzP9mZmb//8zM/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAN2qqv/dqqr/3aqq/92qqv8AAAAAAAAAAGZmZv/////////////////MzMz/ZmZm////////////ZmZm/8zMzP//////ZmZm/7uIiP//zMz/ZmZm/2ZmZv9mZt3/Zmbd/2ZmZv9mZmb//8zM/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAALuIiP/dqqr/3aqq/wAAAAAAAAAAzMzM/2ZmZv9mZmb/ZmZm/2ZmZv9mZmb/zMzM/8zMzP9mZmb/ZmZm/2ZmZv9mZmb/u4iI///MzP//zMz/Zmbd/4iI//+IiP//Zmbd///MzP//zMz/u4iI/wAAAAAAAAAAAAAAAAAAAAD/zMz//8zM/7uIiP/dqqr/u4iI/wAAAABmZmb/////////////////zMzM/2ZmZv///////////2ZmZv/MzMz//////2ZmZv+7iIj//8zM///MzP9mZt3//////4iI//9mZt3//8zM///MzP+7iIj/AAAAAAAAAAAAAAAAAAAAAP//////zMz/ZmZm/92qqv+7iIj/AAAAAMzMzP//////ZmZm/2ZmZv9mZmb/ZmZm/8zMzP/MzMz/ZmZm/2ZmZv9mZmb/ZmZm/7uIiP//zMz/ZmZm/2ZmZv9mZt3/Zmbd/2ZmZv9mZmb//8zM/7uIiP8AAAAAAAAAAAAAAAAAAAAA///////MzP9mZmb//////wAAAAAAAAAAzMzM/2ZmZv///////////8zMzP9mZmb/ZmZm/2ZmZv9mZmb/zMzM//////9mZmb/u4iI/7uIiP//zMz/ZmZm///MzP//zMz/ZmZm///MzP+7iIj/u4iI/wAAAAAAAAAAAAAAAMzMzP//////ZmZm/8zMzP//////AAAAAAAAAAAAAAAAzMzM//////9mZmb/ZmZm/8zMzP/MzMz/zMzM/8zMzP9mZmb/ZmZm//////9mZmb/u4iI/7uIiP//zMz//8zM///MzP//zMz/u4iI/7uIiP8AAAAAAAAAAAAAAAAAAAAA//////////9mZmb/zMzM///////////////////////MzMz/ZmZm/2ZmZv/MzMz/zMzM////////////zMzM/8zMzP9mZmb/ZmZm/8zMzP9mZmb/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAD/////zMzM/2ZmZv//////zMzM/////////////////2ZmZv9mZmb/zMzM/8zMzP9mZmb/ZmZm/2ZmZv9mZmb/zMzM/8zMzP9mZmb/ZmZm/2ZmZv9ERET/RERE/0RERP9mZmb/ZmZm/2ZmZv8AAAAAAAAAAAAAAAAAAAAAzMzM//////9mZmb/zMzM///////MzMz/zMzM/8zMzP/MzMz/zMzM/2ZmZv/MzMz/ZmZm/2ZmZv9mZmb/ZmZm/2ZmZv9mZmb/zMzM/2ZmZv/MzMz/zMzM////////////zMzM////////////zMzM/wAAAAAAAAAAAAAAAAAAAAD//////////wAAAADMzMz/zMzM/wAAAAAAAAAAAAAAAAAAAAAAAAAAZmZm/8zMzP9mZmb/zMzM////////////zMzM/2ZmZv/MzMz/ZmZm/2ZmZv9ERET/zMzM/8zMzP/MzMz////////////MzMz/AAAAAAAAAAAAAAAAAAAAAP/////MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZmZm/8zMzP//////zMzM/8zMzP//////zMzM/2ZmZv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMzMz/zMzM/wAAAAAAAAAAAAAAAAAAAADMzMz//////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzMzM/8zMzP///////////2ZmZv9mZmb/ZmZm/2ZmZv///////////8zMzP/MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMzMzP/MzMz//////////////////////2ZmZv9mZmb//////////////////////8zMzP/MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/////8zMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzMzM//////9mZmb/ZmZm/2ZmZv//////////////////////ZmZm/2ZmZv9mZmb//////8zMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMzMz//////2ZmZv9mZmb/ZmZm/2ZmZv///////////2ZmZv9mZmb/ZmZm/2ZmZv//////zMzM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMzMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMzMzP/MzMz/ZmZm/2ZmZv9mZmb/ZmZm////////////ZmZm/2ZmZv9mZmb/ZmZm/8zMzP/MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMzMzP//////ZmZm/2ZmZv9mZmb///////////9mZmb/ZmZm/2ZmZv//////zMzM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzMzM/8zMzP///////////////////////////////////////////8zMzP/MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzMzM/8zMzP/MzMz//////////////////////8zMzP/MzMz/zMzM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMzMzP/MzMz/zMzM/8zMzP/MzMz/zMzM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            BOTTLE_BLUE : "Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/MzP//zMz/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv//zMz//8zM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/zMz/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv///////////92qqv/dqqr//8zM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/8zM/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr//////92qqv/dqqr//8zM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/zMz/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/8zM/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/zMz/3aqq/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq///MzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/MzP+7iIj/u4iI/92qqv/dqqr/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr//8zM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/8zM/7uIiP+7iIj/3aqq/92qqv+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP/dqqr/3aqq/8zMzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////zMzM/7uIiP//////u4iI/7uIiP+7iIj/u4iI/8zMzP/MzMz/zMzM/8zMzP/MzMz/zMzM/8zMzP//////zMzM///MzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//////////zMzM////////////zMzM/8zMzP/MzMz/zMzM/8zMzP/MzMz/zMzM/8zMzP/MzMz/zMzM///////MzMz//8zM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/////MzMz/////////////////zMzM/8zMzP/MzMz/zMzM/8zMzP/MzMz/zMzM/8zMzP//////zMzM///MzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA///////////MzMz/////////////////zMzM/8zMzP/MzMz/zMzM/8zMzP/MzMz////////////MzMz//8zM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA///////////MzMz/zMzM/8zMzP/MzMz/zMzM/8zMzP/MzMz////////////MzMz/zMzM///MzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA///////////////////////////MzMz/zMzM/8zMzP/MzMz/zMzM///MzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//////////zMzM/8zMzP/MzMz/zMzM/8zMzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/////MzMz/zMzM/8zMzP/MzMz//8zM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/////8zMzP/MzMz/zMzM/8zMzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////zMzM/8zMzP/MzMz/zMzM///MzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/////MzMz/zMzM/8zMzP/MzMz//8zM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/////8zMzP/MzMz/zMzM/8zMzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////zMzM/8zMzP/MzMz/zMzM///MzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/////MzMz/zMzM///MzP//zMz//8zM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/8zM/8zMzP/MzMz/zMzM///MzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/MzP//zMz/zMzM/8zMzP/MzMz/zMzM///MzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/zMz/zMzM/8zMzP9mZmb/ZmZm/2ZmZv9mZmb/zMzM/8zMzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/MzP/MzMz/ZmZm/2ZmZv9mZmb/ZmZm/2ZmZv9mZmb/zMzM///MzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/MzP/////////////////////////////MzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            GEM_BLUE : "Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/u4iI/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/7uIiP+7iIj/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv/dqqr/u4iI/92qqv/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP/dqqr//8zM/92qqv+7iIj/3aqq///MzP/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq///MzP//zMz/3aqq/7uIiP+7iIj//8zM/92qqv/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv/dqqr//8zM///MzP/dqqr/u4iI/7uIiP/dqqr/3aqq/92qqv/dqqr/u4iI/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP/dqqr/u4iI/92qqv//zMz//8zM/7uIiP/dqqr/3aqq/7uIiP/dqqr/3aqq/92qqv+7iIj/u4iI/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv/dqqr/3aqq/92qqv+7iIj/3aqq/92qqv/dqqr/3aqq/7uIiP/dqqr/u4iI/92qqv/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq///MzP/dqqr/u4iI/92qqv//zMz//8zM/92qqv/dqqr/3aqq/7uIiP/dqqr/3aqq/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP/dqqr//8zM///MzP+7iIj/3aqq///MzP//zMz//8zM/92qqv/dqqr/u4iI/92qqv/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI///MzP//zMz//8zM/7uIiP//zMz//8zM///MzP//zMz//8zM/92qqv+7iIj/3aqq/92qqv/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj//8zM///MzP//zMz/u4iI////////zMz//8zM///MzP//zMz/3aqq/7uIiP/dqqr/3aqq/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP//zMz//8zM///MzP+7iIj////////MzP//zMz//8zM///MzP/dqqr/u4iI/92qqv/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI///MzP//zMz//8zM/7uIiP/////////////MzP//zMz//8zM/92qqv+7iIj/3aqq/92qqv/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj//8zM///MzP//zMz/u4iI///////////////////MzP//zMz/3aqq/7uIiP/dqqr/3aqq/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP//zMz//8zM/92qqv+7iIj/3aqq///////////////////MzP/dqqr/u4iI/92qqv/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI///MzP/dqqr/3aqq/92qqv+7iIj/3aqq///MzP//zMz/3aqq/7uIiP/dqqr/u4iI/92qqv/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/92qqv/dqqr//8zM/92qqv+7iIj/3aqq/92qqv+7iIj/3aqq///MzP/dqqr/u4iI/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq///MzP//zMz//8zM/92qqv+7iIj/u4iI/92qqv//zMz//8zM///MzP+7iIj/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq///MzP//zMz//8zM/92qqv/dqqr//8zM///MzP//zMz/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq///MzP//zMz/u4iI/92qqv//zMz//8zM/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq///MzP+7iIj/3aqq/92qqv/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/7uIiP+7iIj/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/u4iI/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            BOTTLE_RED : "Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/MzP//zMz/iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//4iI////zMz//8zM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/zMz/iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//4iI/////////////4iI//+IiP///8zM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/8zM/4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP///////4iI//+IiP///8zM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/zMz/iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//4iI////zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/8zM/4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//4iI////zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/zMz/iIj//2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//iIj////MzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/MzP9mZt3/Zmbd/4iI//+IiP//Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/4iI//+IiP//iIj//4iI//+IiP///8zM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/8zM/2Zm3f9mZt3/iIj//4iI//9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f+IiP//iIj//8zMzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////zMzM/2Zm3f//////Zmbd/2Zm3f9mZt3/Zmbd/8zMzP/MzMz/zMzM/8zMzP/MzMz/zMzM/8zMzP//////zMzM///MzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//////////zMzM////////////zMzM/8zMzP/MzMz/zMzM/8zMzP/MzMz/zMzM/8zMzP/MzMz/zMzM///////MzMz//8zM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/////MzMz/////////////////zMzM/8zMzP/MzMz/zMzM/8zMzP/MzMz/zMzM/8zMzP//////zMzM///MzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA///////////MzMz/////////////////zMzM/8zMzP/MzMz/zMzM/8zMzP/MzMz////////////MzMz//8zM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA///////////MzMz/zMzM/8zMzP/MzMz/zMzM/8zMzP/MzMz////////////MzMz/zMzM///MzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA///////////////////////////MzMz/zMzM/8zMzP/MzMz/zMzM///MzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//////////zMzM/8zMzP/MzMz/zMzM/8zMzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/////MzMz/zMzM/8zMzP/MzMz//8zM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/////8zMzP/MzMz/zMzM/8zMzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////zMzM/8zMzP/MzMz/zMzM///MzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/////MzMz/zMzM/8zMzP/MzMz//8zM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/////8zMzP/MzMz/zMzM/8zMzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/////zMzM/8zMzP/MzMz/zMzM///MzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/////MzMz/zMzM///MzP//zMz//8zM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/8zM/8zMzP/MzMz/zMzM///MzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/MzP//zMz/zMzM/8zMzP/MzMz/zMzM///MzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/zMz/zMzM/8zMzP9mZmb/ZmZm/2ZmZv9mZmb/zMzM/8zMzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/MzP/MzMz/ZmZm/2ZmZv9mZmb/ZmZm/2ZmZv9mZmb/zMzM///MzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/MzP/////////////////////////////MzP//zMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            GEM_RED: "Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERmmf9EZpn/RGaZ/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/0Rmmf9EZpn/Zmbd/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARGaZ/2Zm3f9mZt3/RGaZ/2Zm3f9mZt3/Zmbd/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERmmf9mZt3/iIj//2Zm3f9EZpn/Zmbd/4iI//9mZt3/Zmbd/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/4iI//+IiP//Zmbd/0Rmmf9EZpn/iIj//2Zm3f9mZt3/Zmbd/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARGaZ/2Zm3f9mZt3/iIj//4iI//9mZt3/RGaZ/0Rmmf9mZt3/Zmbd/2Zm3f9mZt3/RGaZ/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERmmf9mZt3/RGaZ/2Zm3f+IiP//iIj//0Rmmf9mZt3/Zmbd/0Rmmf9mZt3/Zmbd/2Zm3f9EZpn/RGaZ/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARGaZ/2Zm3f9mZt3/Zmbd/2Zm3f9EZpn/Zmbd/2Zm3f9mZt3/Zmbd/0Rmmf9mZt3/RGaZ/2Zm3f9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/4iI//9mZt3/RGaZ/2Zm3f+IiP//iIj//2Zm3f9mZt3/Zmbd/0Rmmf9mZt3/Zmbd/2Zm3f9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERmmf9mZt3/iIj//4iI//9EZpn/Zmbd/4iI//+IiP//iIj//2Zm3f9mZt3/RGaZ/2Zm3f9mZt3/Zmbd/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARGaZ/4iI//+IiP//iIj//0Rmmf+IiP//iIj//4iI//+IiP//iIj//2Zm3f9EZpn/Zmbd/2Zm3f9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/iIj//4iI//+IiP//RGaZ//////+IiP//iIj//4iI//+IiP//Zmbd/0Rmmf9mZt3/Zmbd/2Zm3f9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERmmf+IiP//iIj//4iI//9EZpn//////4iI//+IiP//iIj//4iI//9mZt3/RGaZ/2Zm3f9mZt3/Zmbd/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARGaZ/4iI//+IiP//iIj//0Rmmf///////////4iI//+IiP//iIj//2Zm3f9EZpn/Zmbd/2Zm3f9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/iIj//4iI//+IiP//RGaZ/////////////////4iI//+IiP//Zmbd/0Rmmf9mZt3/Zmbd/2Zm3f9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERmmf+IiP//iIj//2Zm3f9EZpn/Zmbd/////////////////4iI//9mZt3/RGaZ/2Zm3f9mZt3/Zmbd/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARGaZ/4iI//9mZt3/Zmbd/2Zm3f9EZpn/Zmbd/4iI//+IiP//Zmbd/0Rmmf9mZt3/RGaZ/2Zm3f9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/2Zm3f9mZt3/iIj//2Zm3f9EZpn/Zmbd/2Zm3f9EZpn/Zmbd/4iI//9mZt3/RGaZ/0Rmmf9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/4iI//+IiP//iIj//2Zm3f9EZpn/RGaZ/2Zm3f+IiP//iIj//4iI//9EZpn/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/4iI//+IiP//iIj//2Zm3f9mZt3/iIj//4iI//+IiP//Zmbd/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/4iI//+IiP//RGaZ/2Zm3f+IiP//iIj//2Zm3f9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/4iI//9EZpn/Zmbd/2Zm3f9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/0Rmmf9EZpn/Zmbd/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/RGaZ/0Rmmf9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            WALL: "Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAIkR3/2aIu/9miLv/Zoi7/2aIu/8iRHf/IkR3/0Rmmf8iRHf/RGaZ/yJEd/9EZpn/IkR3/0Rmmf9EZpn/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/Zoi7/2aIu/8iRHf/IkR3/0Rmmf9EZpn/Zoi7/yJEd/8iRHf/IkR3/0Rmmf9EZpn/Zoi7/2aIu/8iRHf/IkR3/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/yJEd/8iRHf/RGaZ/2aIu/9miLv/Zoi7/2aIu/9miLv/Zoi7/yJEd/9EZpn/Zoi7/yJEd/8iRHf/RGaZ/0Rmmf9miLv/Zoi7/yJEd/9EZpn/IkR3/0Rmmf9EZpn/Zoi7/yJEd/9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/IkR3/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9miLv/IkR3/0Rmmf9miLv/Zoi7/yJEd/9EZpn/RGaZ/0Rmmf9miLv/IkR3/yJEd/9EZpn/RGaZ/0Rmmf9miLv/IkR3/0Rmmf8iRHf/IkR3/yJEd/8iRHf/IkR3/0Rmmf8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/RGaZ/0Rmmf9miLv/IkR3/yJEd/9EZpn/RGaZ/2aIu/8iRHf/RGaZ/yJEd/9EZpn/RGaZ/2aIu/8iRHf/RGaZ/yJEd/9miLv/Zoi7/yJEd/8iRHf/RGaZ/yJEd/8iRHf/RGaZ/yJEd/9EZpn/IkR3/0Rmmf9miLv/IkR3/yJEd/9EZpn/RGaZ/2aIu/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/9EZpn/Zoi7/yJEd/9EZpn/IkR3/0Rmmf9EZpn/Zoi7/yJEd/9EZpn/IkR3/yJEd/8iRHf/IkR3/yJEd/9EZpn/RGaZ/0Rmmf9miLv/IkR3/0Rmmf9EZpn/Zoi7/yJEd/9EZpn/RGaZ/0Rmmf8iRHf/RGaZ/0Rmmf9EZpn/IkR3/0Rmmf9miLv/IkR3/0Rmmf8iRHf/RGaZ/0Rmmf9miLv/IkR3/yJEd/8iRHf/Zoi7/2aIu/8iRHf/RGaZ/yJEd/9EZpn/RGaZ/yJEd/8iRHf/IkR3/0Rmmf8iRHf/IkR3/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/9EZpn/RGaZ/2aIu/8iRHf/RGaZ/0Rmmf9EZpn/Zoi7/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/9EZpn/RGaZ/yJEd/9EZpn/Zoi7/2aIu/9miLv/IkR3/0Rmmf9EZpn/Zoi7/yJEd/9EZpn/RGaZ/0Rmmf9miLv/IkR3/yJEd/9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/yJEd/8iRHf/Zoi7/2aIu/9miLv/Zoi7/2aIu/8iRHf/IkR3/0Rmmf9EZpn/IkR3/0Rmmf9EZpn/RGaZ/2aIu/8iRHf/RGaZ/0Rmmf9miLv/IkR3/0Rmmf9EZpn/RGaZ/2aIu/8iRHf/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/yJEd/9EZpn/RGaZ/0Rmmf9EZpn/Zoi7/yJEd/8iRHf/RGaZ/0Rmmf8iRHf/RGaZ/0Rmmf9EZpn/Zoi7/yJEd/8iRHf/RGaZ/2aIu/8iRHf/RGaZ/0Rmmf9EZpn/Zoi7/yJEd/9EZpn/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/RGaZ/0Rmmf8iRHf/IkR3/2aIu/9miLv/Zoi7/yJEd/8iRHf/RGaZ/2aIu/9miLv/IkR3/0Rmmf8iRHf/RGaZ/0Rmmf9EZpn/IkR3/yJEd/9miLv/Zoi7/2aIu/8iRHf/RGaZ/yJEd/9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/yJEd/9EZpn/RGaZ/yJEd/9EZpn/RGaZ/0Rmmf9EZpn/Zoi7/yJEd/9EZpn/RGaZ/2aIu/8iRHf/IkR3/0Rmmf8iRHf/RGaZ/0Rmmf9EZpn/IkR3/0Rmmf9EZpn/Zoi7/yJEd/8iRHf/RGaZ/yJEd/9EZpn/RGaZ/0Rmmf9EZpn/IkR3/0Rmmf9miLv/IkR3/0Rmmf9EZpn/RGaZ/0Rmmf9miLv/IkR3/0Rmmf9EZpn/Zoi7/yJEd/9EZpn/IkR3/0Rmmf9EZpn/RGaZ/yJEd/8iRHf/RGaZ/0Rmmf9miLv/IkR3/0Rmmf8iRHf/RGaZ/yJEd/9EZpn/RGaZ/0Rmmf8iRHf/RGaZ/0Rmmf8iRHf/IkR3/0Rmmf9EZpn/RGaZ/yJEd/8iRHf/RGaZ/0Rmmf9EZpn/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/9EZpn/Zoi7/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/9miLv/Zoi7/2aIu/9miLv/Zoi7/2aIu/9miLv/Zoi7/yJEd/8iRHf/IkR3/2aIu/9miLv/Zoi7/2aIu/9miLv/Zoi7/2aIu/8iRHf/IkR3/2aIu/9EZpn/IkR3/yJEd/9EZpn/RGaZ/0Rmmf9miLv/Zoi7/2aIu/9miLv/Zoi7/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/Zoi7/yJEd/9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/2aIu/8iRHf/RGaZ/2aIu/8iRHf/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9miLv/IkR3/0Rmmf8iRHf/RGaZ/yJEd/9EZpn/IkR3/0Rmmf8iRHf/Zoi7/yJEd/9miLv/RGaZ/yJEd/8iRHf/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf8iRHf/IkR3/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/yJEd/8iRHf/IkR3/0Rmmf8iRHf/RGaZ/yJEd/9EZpn/IkR3/0Rmmf8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/9EZpn/RGaZ/0Rmmf9miLv/Zoi7/2aIu/9miLv/Zoi7/2aIu/9miLv/Zoi7/yJEd/8iRHf/IkR3/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/IkR3/yJEd/9miLv/Zoi7/yJEd/8iRHf/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/Zoi7/yJEd/9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/IkR3/0Rmmf9EZpn/Zoi7/yJEd/8iRHf/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf8iRHf/RGaZ/0Rmmf9miLv/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/9miLv/Zoi7/2aIu/8iRHf/IkR3/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/IkR3/yJEd/8iRHf/RGaZ/yJEd/8iRHf/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/yJEd/8iRHf/RGaZ/0Rmmf9EZpn/RGaZ/2aIu/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/RGaZ/yJEd/9EZpn/IkR3/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/yJEd/9EZpn/RGaZ/0Rmmf9EZpn/Zoi7/yJEd/9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9miLv/Zoi7/2aIu/9miLv/Zoi7/2aIu/9miLv/IkR3/0Rmmf8iRHf/RGaZ/yJEd/9EZpn/IkR3/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/IkR3/yJEd/9EZpn/RGaZ/0Rmmf8iRHf/IkR3/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/2aIu/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/yJEd/8iRHf/Zoi7/2aIu/9miLv/IkR3/yJEd/9EZpn/IkR3/0Rmmf8iRHf/RGaZ/2aIu/9miLv/Zoi7/2aIu/9miLv/Zoi7/2aIu/8iRHf/Zoi7/2aIu/9miLv/Zoi7/2aIu/9miLv/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/yJEd/9miLv/RGaZ/0Rmmf8iRHf/RGaZ/yJEd/9EZpn/IkR3/0Rmmf8iRHf/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/Zoi7/yJEd/9miLv/RGaZ/yJEd/9EZpn/IkR3/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf8iRHf/IkR3/0Rmmf9EZpn/RGaZ/yJEd/8iRHf/IkR3/yJEd/8iRHf/IkR3/yJEd/9EZpn/IkR3/0Rmmf8iRHf/RGaZ/yJEd/9EZpn/IkR3/yJEd/8iRHf/RGaZ/yJEd/8iRHf/RGaZ/0Rmmf9EZpn/RGaZ/yJEd/8iRHf/IkR3/yJEd/8iRHf/RGaZ/0Rmmf9miLv/IkR3/w==",
            DOOR_YELLOW: "Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAABkirz/ZIa8/2SKvP9khrz/ZIq8/2SGvP9khrz/ZIq8/2SKvP9khrz/ZIq8/2SKvP9kirz/AAAAAAAAAABkirz/ZIq8/2SKvP9khrz/ZIq8/2SKvP9khrz/ZIq8/2SGvP9kirz/ZIa8/2SKvP9khrz/AAAAAAAAAAAAAAAAZIa8/2SKvP+Eqtz/jKrc/4yq3P+Eqtz/jKrc/4Sq3P+Mqtz/jKrc/4Sq3P+Mqtz/ZIa8/2SGvP9kirz/ZIq8/2SKvP9khrz/jKrc/4Sq3P+Mqtz/hKrc/4yq3P+Eqtz/jKrc/4Sq3P+Mqtz/jKrc/2SKvP9kirz/AAAAAGSKvP9kirz/jKrc/4yq3P+szvz/pMr8/6zO/P+szvz/rMr8/6zO/P+kyvz/rMr8/4Sq3P+Mqtz/ZIq8/2SGvP9khrz/ZIq8/4yq3P+Eqtz/rMr8/6TK/P+syvz/rM78/6zO/P+kyvz/rMr8/6zO/P+Eqtz/jKrc/2SKvP9khrz/ZIq8/4yq3P+Eqtz/rM78/6TK/P+Mqtz/hKrc/4Sq3P+Eqtz/hKrc/4Sq3P+kyvz/rM78/4Sq3P+Mqtz/ZIq8/2SKvP+Mqtz/hKrc/6TK/P+kyvz/jKrc/4Sq3P+Eqtz/hKrc/4Sq3P+Eqtz/rM78/6zK/P+Eqtz/jKrc/2SKvP9khrz/jKrc/6zK/P+szvz/ZIa8/2SKvP9khrz/ZIq8/2SGvP9kirz/ZIq8/4yq3P+kyvz/rMr8/4Sq3P9khrz/ZIa8/4yq3P+kyvz/rM78/4Sq3P9kirz/ZIa8/2SKvP9khrz/ZIq8/2SGvP9kirz/rMr8/6zO/P+Eqtz/ZIa8/2SKvP+Eqtz/pMr8/2SGvP+szvz/rMr8/6zK/P+szvz/rMr8/6zO/P+syvz/ZIq8/4Sq3P+kyvz/jKrc/2SKvP9kirz/jKrc/6TK/P+Mqtz/ZIq8/6zK/P+szvz/rMr8/6zO/P+syvz/rMr8/6zK/P9kirz/pMr8/4yq3P9kirz/ZIq8/4yq3P+szvz/ZIq8/6TK/P9kirz/ZIq8/2SGvP9kirz/ZIa8/6zO/P9khrz/jKrc/6zO/P+Eqtz/ZIq8/2SKvP+Eqtz/rM78/4Sq3P9khrz/rM78/2SGvP9kirz/ZIa8/2SKvP9kirz/rM78/2SKvP+syvz/hKrc/2SGvP9khrz/hKrc/6TK/P9khrz/rM78/2SGvP+Mqtz/hKrc/4Sq3P9kirz/rMr8/2SKvP+Eqtz/pMr8/4yq3P9khrz/ZIa8/4yq3P+kyvz/jKrc/2SGvP+szvz/ZIa8/4Sq3P+Eqtz/hKrc/2SGvP+kyvz/ZIq8/6TK/P+Mqtz/ZIq8/2SKvP+Mqtz/rM78/2SKvP+syvz/ZIq8/4Sq3P+Mqtz/hKrc/2SGvP+szvz/ZIa8/4yq3P+szvz/hKrc/2SGvP9kirz/jKrc/6zO/P+Eqtz/ZIq8/6zK/P9kirz/jKrc/4Sq3P+Mqtz/ZIq8/6zK/P9kirz/rMr8/4Sq3P9khrz/ZIa8/4Sq3P+kyvz/ZIa8/6zO/P9khrz/hKrc/4Sq3P+Mqtz/ZIq8/6zK/P9kirz/hKrc/6TK/P+Mqtz/ZIq8/2SGvP+Eqtz/rMr8/4Sq3P9kirz/rMr8/2SGvP+Eqtz/jKrc/4Sq3P9khrz/rM78/2SGvP+szvz/jKrc/2SKvP9kirz/jKrc/6zO/P9kirz/pMr8/2SKvP+Mqtz/hKrc/6zK/P+szvz/pMr8/2SKvP+Mqtz/rMr8/4Sq3P9kirz/ZIa8/4yq3P+kyvz/hKrc/2SKvP+syvz/rM78/6TK/P+Mqtz/hKrc/2SKvP+syvz/ZIq8/6TK/P+Eqtz/ZIa8/2SGvP+Eqtz/rMr8/2SGvP+szvz/ZIa8/4yq3P+Eqtz/ZIq8/2SKvP9khrz/hKrc/4Sq3P+szvz/hKrc/4yq3P9kirz/hKrc/6zO/P+Mqtz/hKrc/2SGvP9kirz/ZIq8/4yq3P+Eqtz/ZIa8/6zO/P9khrz/rM78/4yq3P9kirz/ZIq8/4Sq3P+szvz/ZIq8/6zK/P9kirz/hKrc/4yq3P+Eqtz/jKrc/4Sq3P+Mqtz/rMr8/6zO/P+Eqtz/jKrc/2SGvP+Mqtz/pMr8/6zK/P+Eqtz/jKrc/4Sq3P+Eqtz/hKrc/4yq3P9kirz/pMr8/2SKvP+syvz/hKrc/2SGvP9khrz/jKrc/6TK/P9khrz/rM78/2SGvP+Eqtz/jKrc/4Sq3P+Eqtz/rMr8/6zO/P+kyvz/hKrc/4yq3P+Eqtz/hKrc/4Sq3P+Eqtz/rM78/6TK/P+szvz/jKrc/4Sq3P+Mqtz/hKrc/2SGvP+szvz/ZIa8/6zO/P+Eqtz/ZIq8/2SKvP+Eqtz/rM78/2SKvP+kyvz/ZIq8/4yq3P+Eqtz/hKrc/6zK/P+szvz/hKrc/2SGvP9kirz/hKrc/4yq3P+Eqtz/jKrc/2SGvP9kirz/hKrc/6zK/P+kyvz/jKrc/4Sq3P+Eqtz/ZIq8/6zK/P9kirz/rMr8/4Sq3P9khrz/ZIa8/4Sq3P+syvz/ZIa8/6zO/P9khrz/hKrc/4yq3P+Eqtz/rM78/4Sq3P9khrz/ZIq8/2SGvP9kirz/hKrc/4yq3P9kirz/ZIq8/2SGvP9kirz/hKrc/6zO/P+Eqtz/hKrc/4yq3P9khrz/rM78/2SGvP+szvz/jKrc/2SKvP9kirz/jKrc/6zO/P9kirz/rMr8/2SKvP+Eqtz/hKrc/4yq3P+kyvz/jKrc/2SKvP8AAAAAZIa8/2SKvP+Mqtz/hKrc/2SKvP8AAAAAZIq8/2SGvP+Mqtz/pMr8/4yq3P+Eqtz/jKrc/2SKvP+kyvz/ZIq8/6TK/P+Eqtz/ZIa8/2SGvP+Eqtz/pMr8/2SGvP+szvz/ZIa8/4yq3P+Eqtz/hKrc/6zO/P+szvz/jKrc/2SKvP9khrz/hKrc/4yq3P+Eqtz/jKrc/2SKvP9kirz/hKrc/6zK/P+szvz/hKrc/4yq3P+Eqtz/ZIa8/6zO/P9khrz/rM78/4yq3P9kirz/ZIq8/4yq3P+szvz/ZIq8/6TK/P9kirz/jKrc/4Sq3P+Mqtz/hKrc/6TK/P+szvz/rMr8/4Sq3P+Mqtz/hKrc/4yq3P+Eqtz/jKrc/6zK/P+szvz/rM78/4Sq3P+Eqtz/hKrc/4yq3P9kirz/rMr8/2SKvP+syvz/hKrc/2SGvP9khrz/hKrc/6zK/P9khrz/rM78/2SGvP+Eqtz/hKrc/4Sq3P+Eqtz/jKrc/4Sq3P+syvz/pMr8/4yq3P+Eqtz/ZIa8/4Sq3P+kyvz/rM78/4Sq3P+Eqtz/jKrc/4Sq3P+Mqtz/hKrc/2SGvP+szvz/ZIa8/6zO/P+Eqtz/ZIq8/2SKvP+Eqtz/rM78/2SKvP+syvz/ZIq8/4yq3P+Eqtz/ZIq8/2SKvP9khrz/hKrc/4Sq3P+szvz/hKrc/4yq3P9kirz/jKrc/6zO/P+Eqtz/hKrc/2SGvP9kirz/ZIa8/4Sq3P+Mqtz/ZIq8/6TK/P9kirz/rMr8/4Sq3P9khrz/ZIa8/4yq3P+kyvz/ZIa8/6zO/P9khrz/hKrc/4Sq3P+syvz/rMr8/6zO/P9kirz/hKrc/6zK/P+Eqtz/ZIa8/2SKvP+Eqtz/pMr8/4yq3P9kirz/rMr8/6zO/P+syvz/jKrc/4Sq3P9khrz/rM78/2SGvP+szvz/jKrc/2SKvP9kirz/hKrc/6zO/P9kirz/pMr8/2SKvP+Mqtz/hKrc/4yq3P9kirz/rMr8/2SKvP+Mqtz/rM78/4Sq3P9kirz/ZIa8/4yq3P+szvz/hKrc/2SGvP+szvz/ZIa8/4Sq3P+Eqtz/hKrc/2SKvP+syvz/ZIq8/6TK/P+Eqtz/ZIa8/2SGvP+Eqtz/rMr8/2SGvP+szvz/ZIa8/4Sq3P+Mqtz/hKrc/2SGvP+szvz/ZIa8/4Sq3P+kyvz/jKrc/2SGvP9kirz/hKrc/6TK/P+Mqtz/ZIq8/6TK/P9kirz/jKrc/4Sq3P+Mqtz/ZIa8/6zO/P9khrz/rM78/4yq3P9kirz/ZIq8/4yq3P+kyvz/ZIq8/6zK/P9kirz/jKrc/4Sq3P+Eqtz/ZIq8/6zK/P9kirz/jKrc/6zO/P+Eqtz/ZIa8/2SGvP+Mqtz/rM78/4Sq3P9khrz/rM78/2SGvP+Eqtz/hKrc/4yq3P9kirz/pMr8/2SKvP+kyvz/hKrc/2SGvP9khrz/hKrc/6zK/P9kirz/rM78/2SGvP9kirz/ZIa8/2SKvP9khrz/rM78/2SGvP+Eqtz/rMr8/4yq3P9kirz/ZIq8/4Sq3P+kyvz/jKrc/2SGvP+szvz/ZIa8/2SKvP9khrz/ZIq8/2SKvP+syvz/ZIq8/6zK/P+Mqtz/ZIq8/2SKvP+Mqtz/pMr8/2SKvP+syvz/rMr8/6TK/P+szvz/rMr8/6zO/P+kyvz/ZIq8/4yq3P+kyvz/hKrc/2SGvP9kirz/jKrc/6zK/P+Eqtz/ZIq8/6zK/P+szvz/rMr8/6zO/P+kyvz/rMr8/6zO/P9khrz/rM78/4Sq3P9khrz/ZIa8/4Sq3P+syvz/rM78/2SGvP9kirz/ZIq8/2SGvP9kirz/ZIa8/2SKvP+Mqtz/pMr8/6zK/P+Mqtz/ZIq8/2SGvP+Eqtz/rM78/6zK/P+Eqtz/ZIa8/2SKvP9khrz/ZIq8/2SGvP9kirz/ZIa8/6zO/P+kyvz/jKrc/2SKvP9kirz/jKrc/4Sq3P+szvz/pMr8/4yq3P+Eqtz/jKrc/4Sq3P+Mqtz/hKrc/6TK/P+kyvz/hKrc/4yq3P9kirz/ZIa8/4yq3P+Eqtz/pMr8/6zO/P+Eqtz/jKrc/4Sq3P+Mqtz/hKrc/4yq3P+kyvz/rM78/4Sq3P+Eqtz/ZIq8/2SGvP9kirz/hKrc/4Sq3P+szvz/rMr8/6TK/P+szvz/rM78/6TK/P+syvz/rM78/4Sq3P+Mqtz/ZIq8/2SGvP9kirz/ZIq8/4Sq3P+Eqtz/rMr8/6TK/P+szvz/pMr8/6zO/P+syvz/pMr8/6zO/P+Eqtz/jKrc/2SKvP9khrz/AAAAAGSKvP9kirz/jKrc/4Sq3P+Eqtz/jKrc/4Sq3P+Eqtz/hKrc/4Sq3P+Eqtz/jKrc/2SKvP9kirz/ZIq8/2SKvP9kirz/ZIa8/4yq3P+Eqtz/hKrc/4yq3P+Eqtz/hKrc/4Sq3P+Mqtz/hKrc/4yq3P9kirz/ZIa8/wAAAAAAAAAAAAAAAGSGvP9kirz/ZIa8/2SKvP9khrz/ZIq8/2SGvP9kirz/ZIa8/2SKvP9kirz/ZIa8/2SGvP8AAAAAAAAAAGSKvP9kirz/ZIq8/2SKvP9khrz/ZIq8/2SGvP9khrz/ZIq8/2SGvP9kirz/ZIa8/2SKvP8AAAAAAAAAAA==",
            KEY_BLUE:"Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/92qqv/dqqr/3aqq///MzP//zMz//8zM///MzP/dqqr/3aqq/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv//zMz//8zM///MzP//zMz/3aqq/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/92qqv/dqqr/RGaZ/0Rmmf9EZpn/3aqq/92qqv//zMz//8zM///MzP//zMz/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv/dqqr/3aqq/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/3aqq///MzP//zMz//8zM///MzP/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/92qqv/dqqr/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf/dqqr//8zM///MzP//zMz//8zM///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP/dqqr//8zM/92qqv9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/92qqv//zMz//8zM///MzP//zMz//8zM/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv//zMz/3aqq/92qqv9EZpn/RGaZ/0Rmmf/dqqr/3aqq///MzP//zMz//8zM///MzP//zMz/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq///MzP//zMz/3aqq/92qqv/dqqr/3aqq/92qqv//zMz//8zM///MzP//zMz//8zM///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP/dqqr//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv/dqqr//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/92qqv//zMz//8zM///MzP//zMz//8zM///MzP//zMz/3aqq/92qqv/dqqr//8zM///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/92qqv/dqqr//8zM///MzP//zMz//8zM/92qqv/dqqr/3aqq/92qqv/dqqr//8zM///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/7uIiP+7iIj/u4iI/92qqv/dqqr//8zM///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/AAAAAAAAAAAAAAAA3aqq/92qqv/dqqr//8zM///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3aqq/92qqv/dqqr//8zM///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADdqqr/3aqq/92qqv/dqqr//8zM///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN2qqv/dqqr//8zM///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3aqq/92qqv/dqqr//8zM///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADdqqr/3aqq/92qqv/dqqr//8zM///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN2qqv/dqqr/3aqq/92qqv/dqqr//8zM///MzP/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAN2qqv/dqqr//8zM/92qqv+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA3aqq/92qqv/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADdqqr/3aqq/92qqv/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            KEY_RED:"Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERmmf9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERmmf9EZpn/Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/0Rmmf9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/2Zm3f9mZt3/Zmbd/4iI//+IiP//iIj//4iI//9mZt3/Zmbd/2Zm3f9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARGaZ/2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f+IiP//iIj//4iI//+IiP//Zmbd/2Zm3f9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/2Zm3f9mZt3/RGaZ/0Rmmf9EZpn/Zmbd/2Zm3f+IiP//iIj//4iI//+IiP//Zmbd/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARGaZ/2Zm3f9mZt3/Zmbd/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/Zmbd/4iI//+IiP//iIj//4iI//9mZt3/Zmbd/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/2Zm3f9mZt3/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9mZt3/iIj//4iI//+IiP//iIj//4iI//9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERmmf9mZt3/iIj//2Zm3f9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/2Zm3f+IiP//iIj//4iI//+IiP//iIj//2Zm3f9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARGaZ/2Zm3f+IiP//Zmbd/2Zm3f9EZpn/RGaZ/0Rmmf9mZt3/Zmbd/4iI//+IiP//iIj//4iI//+IiP//Zmbd/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/4iI//+IiP//Zmbd/2Zm3f9mZt3/Zmbd/2Zm3f+IiP//iIj//4iI//+IiP//iIj//4iI//9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERmmf9mZt3/iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//2Zm3f9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARGaZ/2Zm3f9mZt3/iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//Zmbd/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARGaZ/2Zm3f+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//iIj//4iI//9mZt3/Zmbd/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/2Zm3f+IiP//iIj//4iI//+IiP//iIj//4iI//+IiP//Zmbd/2Zm3f9mZt3/iIj//4iI//9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zmbd/2Zm3f9mZt3/iIj//4iI//+IiP//iIj//2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/iIj//4iI//9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/RGaZ/2Zm3f9mZt3/Zmbd/2Zm3f9mZt3/Zmbd/0Rmmf9EZpn/RGaZ/2Zm3f9mZt3/iIj//4iI//9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARGaZ/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/AAAAAAAAAAAAAAAAZmbd/2Zm3f9mZt3/iIj//4iI//9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZmbd/2Zm3f9mZt3/iIj//4iI//9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmZt3/Zmbd/2Zm3f9mZt3/iIj//4iI//9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGZm3f9mZt3/iIj//4iI//9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZmbd/2Zm3f9mZt3/iIj//4iI//9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmZt3/Zmbd/2Zm3f9mZt3/iIj//4iI//9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGZm3f9mZt3/Zmbd/2Zm3f9mZt3/iIj//4iI//9mZt3/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGZm3f9mZt3/iIj//2Zm3f9EZpn/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZmbd/2Zm3f9mZt3/Zmbd/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmZt3/Zmbd/2Zm3f9mZt3/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            KEY_YELLOW: "Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGaIu/9miLv/Zoi7/2aIu/9miLv/Zoi7/2aIu/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGaIu/9miLv/iKrd/4iq3f+Iqt3/iKrd/4iq3f+Iqt3/iKrd/2aIu/9miLv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmiLv/iKrd/4iq3f+Iqt3/iKrd/6rM//+qzP//qsz//6rM//+Iqt3/iKrd/4iq3f9miLv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZoi7/4iq3f+Iqt3/iKrd/4iq3f+Iqt3/iKrd/4iq3f+qzP//qsz//6rM//+qzP//iKrd/4iq3f9miLv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmiLv/iKrd/4iq3f+Iqt3/RGaZ/0Rmmf9EZpn/iKrd/4iq3f+qzP//qsz//6rM//+qzP//iKrd/2aIu/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZoi7/4iq3f+Iqt3/iKrd/0Rmmf9EZpn/RGaZ/0Rmmf9EZpn/iKrd/6rM//+qzP//qsz//6rM//+Iqt3/iKrd/2aIu/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmiLv/iKrd/4iq3f+Iqt3/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf+Iqt3/qsz//6rM//+qzP//qsz//6rM//+Iqt3/Zoi7/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGaIu/+Iqt3/qsz//4iq3f9EZpn/RGaZ/0Rmmf9EZpn/RGaZ/4iq3f+qzP//qsz//6rM//+qzP//qsz//4iq3f9miLv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZoi7/4iq3f+qzP//iKrd/4iq3f9EZpn/RGaZ/0Rmmf+Iqt3/iKrd/6rM//+qzP//qsz//6rM//+qzP//iKrd/2aIu/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmiLv/iKrd/6rM//+qzP//iKrd/4iq3f+Iqt3/iKrd/4iq3f+qzP//qsz//6rM//+qzP//qsz//6rM//+Iqt3/Zoi7/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGaIu/+Iqt3/qsz//6rM//+qzP//qsz//6rM//+qzP//qsz//6rM//+qzP//qsz//6rM//+qzP//qsz//4iq3f9miLv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZoi7/4iq3f+Iqt3/qsz//6rM//+qzP//qsz//6rM//+qzP//qsz//6rM//+qzP//qsz//6rM//+qzP//iKrd/2aIu/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZoi7/4iq3f+qzP//qsz//6rM//+qzP//qsz//6rM//+qzP//qsz//6rM//+qzP//qsz//6rM//+Iqt3/iKrd/2aIu/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmiLv/iKrd/4iq3f+qzP//qsz//6rM//+qzP//qsz//6rM//+qzP//iKrd/4iq3f+Iqt3/qsz//6rM//+Iqt3/Zoi7/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmiLv/iKrd/4iq3f+Iqt3/qsz//6rM//+qzP//qsz//4iq3f+Iqt3/iKrd/4iq3f+Iqt3/qsz//6rM//+Iqt3/Zoi7/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABmiLv/Zoi7/4iq3f+Iqt3/iKrd/4iq3f+Iqt3/iKrd/2aIu/9miLv/Zoi7/4iq3f+Iqt3/qsz//6rM//+Iqt3/Zoi7/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAZoi7/2aIu/9miLv/Zoi7/2aIu/9miLv/AAAAAAAAAAAAAAAAiKrd/4iq3f+Iqt3/qsz//6rM//+Iqt3/Zoi7/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAiKrd/4iq3f+Iqt3/qsz//6rM//+Iqt3/Zoi7/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACIqt3/iKrd/4iq3f+Iqt3/qsz//6rM//+Iqt3/Zoi7/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIiq3f+Iqt3/qsz//6rM//+Iqt3/Zoi7/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAiKrd/4iq3f+Iqt3/qsz//6rM//+Iqt3/Zoi7/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACIqt3/iKrd/4iq3f+Iqt3/qsz//6rM//+Iqt3/Zoi7/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIiq3f+Iqt3/iKrd/4iq3f+Iqt3/qsz//6rM//+Iqt3/Zoi7/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIiq3f+Iqt3/qsz//4iq3f9miLv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAiKrd/4iq3f+Iqt3/iKrd/2aIu/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACIqt3/iKrd/4iq3f+Iqt3/Zoi7/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            NPC001: "Qk02EAAAAAAAADYAAAAoAAAAIAAAACAAAAABACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/u4iI/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/7uIiP/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/92qqv/dqqr/3aqq///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC7iIj/3aqq/92qqv//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM/92qqv/dqqr/3aqq/92qqv/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/3aqq///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM/92qqv/dqqr/3aqq/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP/dqqr/3aqq///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz/3aqq/92qqv/dqqr/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/u4iI/wAAAAAAAAAAu4iI/7uIiP/dqqr//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP/dqqr/3aqq/7uIiP+7iIj/AAAAAAAAAAC7iIj/u4iI/7uIiP8AAAAAAAAAAAAAAAC7iIj/u4iI/7uIiP+7iIj/u4iI/wAAAAAAAAAAu4iI/92qqv/dqqr//8zM///MzP//zMz//8zM///MzP//zMz//8zM///MzP//zMz/3aqq/92qqv/dqqr/u4iI/wAAAAAAAAAAu4iI/7uIiP+7iIj/u4iI/7uIiP8AAAAAAAAAALuIiP9mZmb/ZmZm/7uIiP+7iIj/u4iI/7uIiP+7iIj/3aqq/92qqv/dqqr/3aqq///MzP//zMz//8zM///MzP//zMz//8zM/92qqv/dqqr/3aqq/92qqv+7iIj/u4iI/7uIiP+7iIj/u4iI/2ZmZv9mZmb/u4iI/wAAAAAAAAAAu4iI/2ZmZv9mZmb/u4iI/92qqv/dqqr/u4iI/7uIiP+7iIj/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv+7iIj/u4iI/7uIiP+7iIj/3aqq/92qqv+7iIj/ZmZm/2ZmZv+7iIj/AAAAAAAAAAC7iIj/ZmZm/2ZmZv+7iIj/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/7uIiP9mZmb/ZmZm/7uIiP8AAAAAAAAAAGaIu/9miLv/Zoi7/7uIiP/dqqr/3aqq///MzP//zMz//8zM/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr/3aqq/92qqv/dqqr//8zM///MzP//zMz//8zM/92qqv/dqqr/u4iI/2aIu/9miLv/Zoi7/wAAAAAAAAAAZoi7/6rM//+Iqt3/u4iI/92qqv//zMz//8zM///MzP//zMz//8zM/92qqv/dqqr/3aqq/7uIiP+7iIj/u4iI/7uIiP/dqqr/3aqq///MzP//zMz//8zM///MzP//zMz/3aqq/92qqv+7iIj/iKrd/6rM//9miLv/AAAAAAAAAABmiLv/qsz//4iq3f+7iIj/3aqq///MzP//zMz//8zM///MzP//zMz/3aqq/92qqv+7iIj/zMzM/8zMzP/MzMz/zMzM/7uIiP/dqqr/3aqq///MzP//zMz//8zM///MzP/dqqr/3aqq/7uIiP+Iqt3/qsz//2aIu/8AAAAAAAAAAGaIu/9miLv/iKrd/7uIiP/dqqr//8zM///MzP//zMz//8zM/92qqv/dqqr/u4iI/8zMzP/MzMz////////////MzMz/zMzM/7uIiP/dqqr/3aqq///MzP//zMz//8zM/92qqv/dqqr/u4iI/4iq3f9miLv/Zoi7/wAAAAAAAAAAAAAAAGaIu/9miLv/u4iI/92qqv//zMz//8zM///MzP/dqqr/3aqq/7uIiP/MzMz/zMzM///////////////////////MzMz/zMzM/7uIiP/dqqr/3aqq///MzP//zMz/3aqq/92qqv+7iIj/Zoi7/2aIu/8AAAAAAAAAAAAAAAAAAAAAu4iI/7uIiP+7iIj/3aqq/92qqv/dqqr/3aqq/92qqv+7iIj/zMzM/8zMzP/////////////////////////////////MzMz/zMzM/7uIiP/dqqr/3aqq/92qqv/dqqr/3aqq/7uIiP+7iIj/u4iI/wAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/7uIiP/dqqr/3aqq/92qqv/dqqr/3aqq/7uIiP/MzMz////////////////////////////////////////////MzMz/u4iI/92qqv/dqqr/3aqq/92qqv/dqqr/u4iI/7uIiP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAu4iI/7uIiP+7iIj/3aqq/92qqv+7iIj/zMzM/8zMzP///////////4iq3f+Iqt3/iKrd/4iq3f///////////8zMzP/MzMz/u4iI/92qqv/dqqr/u4iI/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALuIiP+7iIj/u4iI/7uIiP/MzMz///////////+Iqt3/qsz//6rM//+qzP//qsz//4iq3f///////////8zMzP+7iIj/u4iI/7uIiP+7iIj/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzMzM/8zMzP//////////////////////////////////////////////////////zMzM/8zMzP8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADMzMz///////////+Iqt3/iKrd/4iq3f+Iqt3/iKrd/4iq3f+Iqt3/iKrd////////////zMzM/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMzMzP9miLv/iKrd/4iq3f+qzP//qsz//6rM//+qzP//qsz//4iq3f+Iqt3/iKrd/2aIu//MzMz/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAARGaZ/2aIu/+Iqt3/IkR3/yJEd/8iRHf/qsz//6rM//8iRHf/IkR3/yJEd/+Iqt3/Zoi7/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/Zoi7/6rM//////////////////+qzP//qsz//////////////////4iq3f9miLv/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/////////////////zMzM/4iq3f+Iqt3/zMzM/////////////////0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERmmf9miLv/Zoi7/4iq3f+Iqt3/iKrd/4iq3f+Iqt3/iKrd/2aIu/9miLv/RGaZ/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAERmmf9EZpn/Zoi7/2aIu/+Iqt3/iKrd/2aIu/9miLv/RGaZ/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEZpn/RGaZ/0Rmmf9EZpn/RGaZ/0Rmmf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            WARRIOR_BLUE: "Qk2KEAAAAAAAAIoAAAB8AAAAIAAAACAAAAABACAAAwAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAD/AAD/AAD/AAAAAAAA/0JHUnOPwvUoUbgeFR6F6wEzMzMTZmZmJmZmZgaZmZkJPQrXAyhcjzIAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALqJh/+5h4f/uoiK/7qKif+6ion/uYeH/7qKif+6iYf/AAAAAAAAAAC6iIr/uYeH/7qKif+5h4f/uoqJ/7mHh/+6iIr/uomH/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAuoiK/9yqqv/cqqr/3Kqq/9yqqv//zc3//s3L/9yqqv+6ion/uoiK/9yqqv/+zM7//cvL/9yqqv/cqqr/3Kqq/9yqqv+6ion/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC6ion/uoiK/96qqv/9y8v//83N//7Ny///zc3/3qqq/72Jif+6ion/26qs//7+/v/+zM7//szO//3Ly//eqqr/uoiK/7qKif8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC6iYf/uoqJ/7qIiv+5h4f/uoiK/7mHh//Mzcv/AAAAAAAAAADPzc3/uoqJ/7qKif+6iYf/uoiK/7mHh/+6iYf/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAzMvN/8vLy/+6ion/uYeH/83Nzf8AAAAAAAAAAMzNy//+/v7//v7+/8zLzf/Mzcv/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALqIiv+5h4f/z83N//7+/v/Nzc3/zMvN/wAAAAAAAAAAy8vL//7+/v/+/v7/zc3N/7qJh/+6ion/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC6iIr/3Kqq/96qqv+6iYf/y8vL/7qKif+6iYf/uoiK/7qKif+6ion/uoqJ/8vLy/+6iYf/3Kqq/9yqqv+5h4f/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAuoqJ/96qqv/+zM7//s3L//3Ly/+6iIr/3qqq///Nzf/9y8v//83N//3Ly//eqqr/uoiK//3Ly///zc3/uoiK/7qKif8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGaJu/9mibv/Zom7/wAAAAAAAAAAuoqJ/96qqv/9y8v//szO/7qKif/eqqr//cvL///Nzf/9y8v//83N//7Mzv+6ion/3Kqq//7+/v/eqqr/uomH/wAAAAAAAAAAZom7/2WJuf9mibv/AAAAAAAAAAAAAAAAAAAAAAAAAABmibv/qcz+/6nM/v+pzP7/Zom7/wAAAAC6ion/uYeH/96qqv/eqqr/uoiK/96qqv/cqqr//cvL///Nzf/9y8v/3qqq/7mHh//cqqr//cvL/7qJh/+5h4f/AAAAAGaJu/+oy/3/qcz+/6nL//9mibv/AAAAAAAAAAAAAAAAAAAAAGaJu/+pzP7/qcv//4ap2/9mibv/AAAAAAAAAAC6ion/uoiK/7qIiv+6ion/uYeH/7qKif/cqqr/3qqq/7mHh/+6iIr/uomH/7qIiv/eqqr/uoqJ/wAAAAAAAAAAZom7/4ap2/+oy/3/qMv9/2aJu/8AAAAAAAAAAAAAAAAAAAAAz83N/2aJu/9mibv/Zom7/8vLy/8AAAAAAAAAAAAAAAC6ion/3Kqq///Nzf/9y8v/3Kqq/7qJh/+6ion/3Kqq//7Ny//9y8v/3qqq/7qIiv8AAAAAAAAAAAAAAADMzcv/Zom7/2SJu/9mibv/y8vL/wAAAAAAAAAAAAAAAAAAAADMy83//v7+//7+/v/+/v7/zc3N/8/Nzf8AAAAAuYeH/9yqqv/+/v7//v7+//7Mzv//zc3/uYeH/7qJh//9y8v//cvL//7Mzv//zc3/3qqq/7mHh/8AAAAAzMvN/8zNy/9mibv/Zom7/2SJu//Nzc3/AAAAAAAAAAAAAAAAAAAAAMzNy//+/v7//v7+//7+/v/+/v7/z83N/7mHh//cqqr//szO//7+/v//zc3//cvL//3Ly/+6iIr/uoiK//3Ly//+zM7//s3L//3Ly//+zM7/3Kqq/7qKif/My83/zM3L/8zLzf/+/v7//v7+/83Nzf8AAAAAAAAAAAAAAAAAAAAAz83N/8/Nzf/Ly8v/zMvN/8vLy//Ly8v/uoiK/9yqqv/+zM7//s3L//3Ly/+6iIr/uYeH/7qKif+6iYf/uoqJ/7qJh//9y8v//szO/9yqqv/cqqr/uoiK/8zNy//Ly8v/z83N/8vLy//Mzcv/zc3N/wAAAAAAAAAAAAAAAAAAAADMy83/uoiK/7qJh/+6ion/uoiK/7qJh//cqqr/3qqq/9yqqv/9y8v/uYeH/9yqqv/9zcz//s3L/9yqqv/crKv/3Kqq/7qJh//bqqz/3qqq/9yqqv/cqqr/uoiK/7mHh/+5h4f/uoqJ/7mHh//Pzc3/AAAAAAAAAAAAAAAAAAAAALqKif/cqqr/3Kqq/96qqv/eqqr/3qqq/7mHh/+6iIr/3Kqq/9yqqv+6ion//s3L/9yqqv/cqqr/3Kqq/9yqqv/cqqr/uoiK/7qJh/+6ion/uoqJ/7mHh//cqqr/3qqq/96qqv/eqqr/3Kqq/7qKif8AAAAAAAAAAAAAAAC6ion/3qqq/7qIiv+6ion/uoqJ/7mHh/+6ion/3Kqq/9yqqv+6iYf/uYeH/9yqqv/cqqr/3Kqq/9yqqv/cqqr/3Kqq/9uqrP/eqqr/uoiK/7mHh//eqqr/3Kqq/7qIiv+5h4f/uomH/7qIiv+9iYn/3qqq/7mHh/8AAAAAvYmJ/96qqv+5h4f//83N//3Ly///zc3//cvL///Nzf+6ion/uomH/9yqqv/cqqr/uoqJ/9yqqv9DZZr/RWaX/0RomP9FZpf/3Kqq/7qJh//cqqr/uoqJ/7mHh/+6ion//cvL//7Mzv//zc3//cvL//3Ly/+6ion/3Kqq/7qKif+6iIr/uYeH//7Mzv/+/v7//83N///Nzf/9y8v//83N//3Ly//crKv/uoiK/9yqqv9DZZr/RWaX/2SJu/+Fqtz/iKvd/2aJu/9FZpf/RWaX/9yqqv+6iYf/3Kqq///Nzf/9y8v//s3L//3Ly///zc3//cvL///Nzf+6iIr/uYeH/7qKif/cqqr/3Kqq//7+/v/+/v7//s3L///Nzf//zc3//cvL/9yqqv+6ion/RWaX/2SJu/+Iq93/qcz+/6nM/v+pzP7/hqnb/4ap2/9mibv/RWaY/wAAAADeqqr//cvL//7Mzv/+zcv//szO//7Ny//eqqr/3Kqq/96qqv+6ion/AAAAALqKif/eqqr/3Kqq//7Mzv/9y8v//cvL/96qqv+6ion/uomH/wAAAABFZpf/iKvd/6nM/v+pzP7/qcz+/6nM/v+pzP7/iKvd/4ap2/9FZpf/AAAAALqJh/+6ion/3qqq//3Ly//9y8v//szO/96qqv/eqqr/uYeH/wAAAAAAAAAAAAAAALqKif+6iYf/uoiK/7qKif+6ion/AAAAAAAAAAAAAAAARWaX/2SJu/+pzP7/qcz+/6nM/v+pzP7/qcz+/6jL/f+Iq93/hqnb/2aJu/9DZZr/AAAAAAAAAAC6iYf/uoiK/7qKif+6iYf/uoiK/7qKif8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACJFd/9DZZr/hqnb/6nM/v8gQ3X/IEN1/6nM/v+pzP7/IEN1/yFFdf+Iq93/hqnb/0VmmP8iRXf/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIkV3/yBDdf9kibv/iKvd/4ir3f+Iq93/qMv9/6jL/f+Iq93/hqnb/yBDdf9kibv/IEN1/yJFd/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAiRXf/IEN1/yFFdf9mh7n/harc/yFFdf+Iq93/harc/4ir3f8hRXX/Q2Wa/yFFdf8hRXX/IkN1/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACJFd/9DZZr/IUV1/yFFdf8hRXX/Q2Wa/yFFdf+Iq93/IEN1/yBDdf8hRXX/IkV3/0Nlmv8iRXf/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIkV3/yJFd/9FZpf/IUV1/0Nlmv8hRXX/Q2eX/yFFdf8hRXX/IUV1/0Vml/8hRXX/IEN1/yJFd/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIEN1/yFFdf9FZpf/RWaX/0Nlmv9FZpf/Q2Wa/yJEef9FZpf/IkV3/0Vml/8iRXf/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAiRXf/IkV3/0Vml/9DZZr/Q2Wa/0Nlmv8hRXX/Q2Wa/yJDdf9DZZr/IkV3/yFFdf8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAiRXf/IkN1/yJDdf9FZpf/IEN1/0Vml/8iQ3X/IkV3/yJFd/8iRXf/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIkV3/yJFd/8iRXf/IkV3/yJFd/8iRXf/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
            BACKGROUND: "Qk02EAAAAAAAADYAAAAoAAAAIAAAAOD///8BACAAAAAAAAAQAAATCwAAEwsAAAAAAAAAAAAAQURB/0lISf9BREH/amxq/0FEQf9qaGr/QURB/2psav9BREH/SUhJ/0lISf9qaGr/QURB/0lISf9JSEn/SUhJ/0lISf9JSEn/QURB/2poav9qaGr/YmRi/0lISf9JSEn/SUhJ/0FEQf9qbGr/YmRi/0lISf9JSEn/QURB/0lISf9qbGr/QURB/2psav9BREH/amhq/0FEQf9qbGr/YmRi/2poav9BREH/QURB/0FEQf9qaGr/QURB/2JkYv9BREH/SUhJ/2JkYv9JSEn/QURB/2poav9BREH/SUhJ/2JkYv9BREH/amxq/0FAQf9qaGr/QURB/2JkYv9qbGr/YmRi/0lISf9JSEn/QURB/2psav9JSEn/amhq/2poav9JSEn/SUhJ/0FEQf9JSEn/amhq/0lISf9qaGr/amxq/2poav9qaGr/amhq/2poav9JSEn/SUhJ/0lESf9qbGr/QURB/2poav9BREH/amxq/2poav9qaGr/SUhJ/2poav9JSEn/amxq/0FEQf9qaGr/QURB/2psav9BREH/SUhJ/0FEQf9qbGr/QUhB/0FIQf9BREH/amxq/0FEQf9JSEn/QURB/0FEQf9JSEn/QURB/0lISf9BREH/QURB/0FEQf9qaGr/SUhJ/2poav9qaGr/amhq/2JkYv9qaGr/SUhJ/2poav9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/ZWVl/2VlZf9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/0NDQ/9DQ0P/ZWVl/0NDQ/9lZWX/Q0ND/0NDQ/9lZWX/Q0ND/2VlZf9lZWX/ZWVl/0NDQ/9DQ0P/Q0ND/2VlZf9DQ0P/Q0ND/0NDQ/9lZWX/ZWVl/2VlZf9DQ0P/Q0ND/0NDQ/9DQ0P/ZWVl/2VlZf9lZWX/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/0NDQ/9DQ0P/Q0ND/w==",
            SLM_GREEN : "Qk02EAAAAAAAADYAAAAoAAAAIAAAAOD///8BACAAAAAAAAAQAADEDgAAxA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqzKr/qsyq/6rMqv+qzKr/qsyq/6rMqv+qzKr/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKrMqv+qzKr/qsyq/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/6rMqv+qzKr/qsyq/6rMqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqzKr/qsyq/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/6rMqv/M7sz/qsyq/6rMqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAqsyq/6rMqv/M7sz/zO7M/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/6rMqv/M7sz/qsyq/6rMqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqzKr/zO7M/8zuzP/MzMz/zMzM/8zMzP/M7sz/zO7M/8zuzP/M7sz/zO7M/8zMzP/MzMz/zMzM/6rMqv/M7sz/qsyq/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAqsyq/6rMqv/M7sz/zMzM/////////////////8zMzP/M7sz/zO7M/8zuzP/MzMz/////////////////zMzM/6rMqv+qzKr/qsyq/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqzKr/zO7M/8zMzP///////////0RERP9ERET//////8zMzP/M7sz/zMzM//////9ERET/RERE////////////zMzM/6rMqv+qzKr/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKrMqv/M7sz/zMzM////////////RERE/8zMzP//////zMzM/8zuzP/MzMz//////8zMzP9ERET////////////MzMz/zO7M/6rMqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAqsyq/8zuzP/MzMz///////////9ERET/RERE///////MzMz/zO7M/8zMzP//////RERE/0RERP///////////8zMzP+qzKr/qsyq/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqzKr/qsyq/8zuzP/MzMz/////////////////zMzM/8zuzP/M7sz/zO7M/8zMzP/////////////////MzMz/qsyq/6rMqv+qzKr/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACqzKr/zO7M/8zuzP/MzMz/zMzM/8zMzP/M7sz/zO7M/8zuzP/M7sz/zO7M/8zMzP/MzMz/zMzM/6rMqv/M7sz/qsyq/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKrMqv+qzKr/zO7M/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/8zuzP+qzKr/zO7M/6rMqv+qzKr/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKrMqv+qzKr/zO7M/8zuzP/M7sz/zO7M/8zuzP/M7sz/zO7M/6rMqv/M7sz/qsyq/8zuzP+qzKr/qsyq/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKrMqv+qzKr/qsyq/8zuzP/M7sz/qsyq/8zuzP+qzKr/zO7M/6rMqv+qzKr/qsyq/6rMqv8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAqsyq/6rMqv+qzKr/qsyq/6rMqv+qzKr/qsyq/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="
        }
    },
    CANVAS : {
        EMPTY_CANVAS: {},
        MAP_CANVAS: {},
        GUI_CANVAS: {},
        BACK_CANVAS: {},
        LEFT_STATUS_CANVAS: {},
        RIGHT_STATUS_CANVAS: {},
        MSG_CANVAS: {},
        ITEM_CANVAS: {},
        KEY_CANVAS: {},
        DIALOG_CANVAS: {}
    }
    ,
    CACHE : {
        BMD : {}
    },
    KEY_BLOCKED : false,
    MOUSE_BLOCKED : false,
    TIME : 0,
    REF_TIME : 0,
    SAVE_DATA : {},
    SAVE_DATA_BASE64 : {},
    SPECIAL_OBJ : {},
    EDIT_ITEMS : [[]],
    CURR_EDIT_PAGE_ID : 0,
    CURR_EDIT_OBJS : [],
    SPECIAL : {
        YES_CALLBACK : function () {
            trace("yes");
        },
        NO_CALLBACK : function () {
            trace("no");
        }
    }
};


function initMap() {
    Global.CURRENT_MAP.length = Global.MAP_SIZE.x;

    var map_data = [];
    map_data.length = Global.MAP_SIZE.x;
    for (var i = 0; i < Global.CURRENT_MAP.length; i++) {
        Global.CURRENT_MAP[i] = [];
        Global.CURRENT_MAP[i].length = Global.MAP_SIZE.y;

        map_data[i] = [];
        map_data[i].length = Global.MAP_SIZE.y;
        for (var j = 0; j < Global.MAP_SIZE.y; j++) {
            map_data[i][j] = [];
        }
    }

    for (var i = 0; i < Global.MAP_SIZE.x; i++) {
        for (var j = 0; j < Global.MAP_SIZE.y; j++) {
            Global.CURRENT_MAP[i][j]= {};
            Global.CURRENT_MAP[i][j].objects = [];
            var obj =  createBMPObj(32, 32, "BACKGROUND", Global.TYPE.BACKGROUND, 0, Global.MAP_SCALE, Global.CANVAS.MAP_CANVAS);

            obj.shape.x = i * Global.BLOCK_SIZE.x;
            obj.shape.y = j * Global.BLOCK_SIZE.y;
            obj.x = i;
            obj.y = j;
            obj.onClicked = function() {

                var xx = this.x;
                var yy = this.y;

                if (Mouse.target != null && Global.CURRENT_MAP[xx][yy].objects.length == 0) {
                    placeObjWithTrigger(Mouse.target.bmp_type, Mouse.target.type, xx, yy, Global.CURRENT_MAP);
                } else if (Global.CURRENT_MAP[xx][yy].objects.length >= 1) {
                    removeObj(Global.CURRENT_MAP[xx][yy].objects[Global.CURRENT_MAP[xx][yy].objects.length - 1], Global.CURRENT_MAP);
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
            /*Global.CURRENT_MAP[i][j].objects.push(obj);*/
        }
    }
    Global.MAPS.push([]);
    Global.FLOOR_IDS.push(1);
    Global.CURRENT_FLOOR = 1;
    saveCurrentMap();
}

function goUp(floors) {
    saveCurrentMap();
    var idx = Global.FLOOR_IDS.indexOf(Global.CURRENT_FLOOR);
    while (idx < Global.FLOOR_IDS.length - 1  && floors > 0) {
        idx += 1;
        floors -= 1;
    }
    Global.CURRENT_FLOOR = Global.FLOOR_IDS[idx];
    loadCurrentMap();
}

function goDown(floors) {
    saveCurrentMap();

    var idx = Global.FLOOR_IDS.indexOf(Global.CURRENT_FLOOR);
    while (idx != 0 && floors > 0) {
        idx -= 1;
        floors -= 1;
    }
    Global.CURRENT_FLOOR = Global.FLOOR_IDS[idx];
    loadCurrentMap();
}

function initPlayer() {
    Global.PLAYER = createBMPObj(32, 32, "WARRIOR_BLUE", Global.TYPE.PLAYER, 0, Global.MAP_SCALE, Global.CANVAS.MAP_CANVAS);
    Global.PLAYER.shape.x = Global.BLOCK_SIZE.x * 5;
    Global.PLAYER.shape.y = Global.BLOCK_SIZE.y * 5;
    Global.PLAYER.x = 5;
    Global.PLAYER.y = 5;
    Global.PLAYER.status = clone(Global.DATA.PLAYER);
    /*Global.MAP[5][5].objects.push(Global.PLAYER);*/

    Global.PLAYER.items = [];
    Global.PLAYER.keys = [];
    Global.PLAYER.moveUp = function () {
        if (this.y > 0) {
            this.y -= 1;
            this.shape.y = Global.BLOCK_SIZE.y * this.y;
        }
    };

    Global.PLAYER.moveDown = function () {
        if (this.y < Global.MAP_SIZE.y - 1) {
            this.y += 1;
            this.shape.y = Global.BLOCK_SIZE.y * this.y;
        }
    };

    Global.PLAYER.moveLeft = function () {
        if (this.x > 0) {
            this.x -= 1;
            this.shape.x = Global.BLOCK_SIZE.x * this.x;
        }
    };

    Global.PLAYER.moveRight = function () {
        if (this.x < Global.MAP_SIZE.x - 1) {
            this.x += 1;
            this.shape.x = Global.BLOCK_SIZE.x * this.x;
        }
    };

    /*Global.PLAYER.rigid = true;*/
    Global.PLAYER.pay = function (amount) {
        if  (this.status.GOLD < amount) {
            log("你的金币不够");
            return false;
        } else {
            this.status.GOLD -= amount;
            log("购买成功");
            return true;
        }
    };
    Global.PLAYER.removeOneKey = function (type) {
        var index = -1;
        for (var i = 0; i < this.keys.length; i++) {
            var key = this.keys[i];
            if (key.type == type) {
                index = i;
                break;
            }
        }
        if (index == -1) return false;
        this.keys.splice(index, 1);
        return true;
    };
    Global.PLAYER.openDoor = function (door) {
        if (door == Global.TYPE.DOOR_YELLOW) {
            if (!this.removeOneKey(Global.TYPE.KEY_YELLOW)) {
                return false;
            }
        } else if (door == Global.TYPE.DOOR_BLUE) {
            if (!this.removeOneKey(Global.TYPE.KEY_BLUE)) {
                return false;
            }
        } else if (door == Global.TYPE.DOOR_RED) {
            if (!this.removeOneKey(Global.TYPE.KEY_RED)) {
                return false;
            }
        }
        return true;
    };
    Global.PLAYER.onCollision = function (obj, dir) {
        /* TODO: check if it is monster */
        if (obj.type.indexOf("BLK") >= 0 || obj.type.indexOf("NPC") >= 0) {
            if (dir == "LEFT") Global.PLAYER.moveRight();
            else if (dir == "RIGHT") Global.PLAYER.moveLeft();
            else if (dir == "UP") Global.PLAYER.moveDown();
            else if (dir == "DOWN") Global.PLAYER.moveUp();
            Global.REF_TIME = Global.TIME;
        }
        if (obj.type.indexOf("MN_") == 0) {
            enterBattle(Global.PLAYER, obj, true);
        }
    };
    Global.PLAYER.onBattleWin = function (obj) {
        log("你赢了");
        removeObj(obj, Global.CURRENT_MAP);
    };
}

function placeObj(bmp_type, type, x, y, map) {
    var obj = createBMPObj(32, 32, bmp_type, type, 0, Global.MAP_SCALE, Global.CANVAS.MAP_CANVAS);
    obj.shape.x = Global.BLOCK_SIZE.x * x;
    obj.shape.y = Global.BLOCK_SIZE.y * y;
    obj.x = x;
    obj.y = y;
    obj.status = clone(Global.DATA[type]);
    map[x][y].objects.push(obj);
    /*if (map_data != null) {
        map_data[x][y].push(Global.TYPE_TO_ID[obj.type.toString()]);
    }*/
    return obj;
}

function removeObj(obj, map) {
    var x = parseInt(obj.x);
    var y = parseInt(obj.y);
    trace(x);
    ScriptManager.popEl(obj.shape);
    var index = map[x][y].objects.indexOf(obj);
    trace(index);
    map[x][y].objects.splice(index, 1);
    /*if (map_data != null) {
        var data_index = map_data[x][y].indexOf(Global.TYPE_TO_ID[obj.type.toString()]);
        map_data[x][y].splice(data_index, 1);
    }*/
    obj.Destroy();
}

function placeObjWithTrigger(bmp_type, type, x, y, map) {
    var place_obj = placeObj(bmp_type, type, x, y, map);
    place_obj.rigid = true;
    if (place_obj.type == Global.TYPE.NPC_TRADE) {
        place_obj.onCollision = function (obj, dir) {
            createDialogStrip([["1",  function () {
                Global.PLAYER.status.HP -= 10;
                refreshPlayerStatus();
            }, function () {

            }], ["2", function () {
                Global.PLAYER.status.HP += 10;
                refreshPlayerStatus();
            }], ["3", function () {
                Global.PLAYER.status.HP -= 50;
                refreshPlayerStatus();
            }]]);
        };
    } else if (place_obj.type.indexOf("KEY_") == 0) {
        place_obj.onCollision = function (obj, dir) {
            obj.keys.push({
                bmp_type: place_obj.bmp_type,
                type : place_obj.type
            });
            refreshPlayerKeys();
            removeObj(place_obj, Global.CURRENT_MAP);
        };
    } else if (place_obj.type.indexOf("DOOR_") == 0) {
        place_obj.onCollision = function (obj, dir) {
            if (obj.openDoor(place_obj.type)) {
                refreshPlayerKeys();
                removeObj(place_obj, Global.CURRENT_MAP);
            } else {
                if (place_obj.type == "DOOR_YELLOW") {
                    log("你还没有黄钥匙");
                } else if (place_obj.type == "DOOR_BLUE") {
                    log("你还没有蓝钥匙");
                } else if (place_obj.type == "DOOR_RED") {
                    log("你还没有红钥匙");
                }

                if (dir == "LEFT") Global.PLAYER.moveLeft();
                else if (dir == "RIGHT") Global.PLAYER.moveRight();
                else if (dir == "UP") Global.PLAYER.moveUp();
                else if (dir == "DOWN") Global.PLAYER.moveDown();
                Global.REF_TIME = Global.TIME;
            }
        };
    } else if (place_obj.type == Global.TYPE.ATK_UP3) {
        place_obj.onCollision = function (obj, dir) {
            obj.status.ATK += 3;
            refreshPlayerStatus();
            removeObj(place_obj, Global.CURRENT_MAP);
        };
    } else if (place_obj.type == Global.TYPE.DEF_UP3) {
        place_obj.onCollision = function (obj, dir) {
            obj.status.DEF += 3;
            refreshPlayerStatus();
            removeObj(place_obj, Global.CURRENT_MAP);
        };
    } else if (place_obj.type == Global.TYPE.HP_UP200) {
        place_obj.onCollision = function (obj, dir) {
            obj.status.HP += 200;
            refreshPlayerStatus();
            removeObj(place_obj, Global.CURRENT_MAP);
        };
    } else if (place_obj.type == Global.TYPE.HP_UP500) {
        place_obj.onCollision = function (obj, dir) {
            obj.status.HP += 500;
            refreshPlayerStatus();
            removeObj(place_obj, Global.CURRENT_MAP);
        };
    } else if (place_obj.type == Global.TYPE.TRANSPORT_UP) {
        Global.SPECIAL_OBJ = place_obj;
        place_obj.onCollision = function (obj, dir) {
            obj.rigid = false;
            goUp(place_obj.specials[0]);
            Global.PLAYER.shape.x = Global.BLOCK_SIZE.x * place_obj.specials[1];
            Global.PLAYER.shape.y = Global.BLOCK_SIZE.y * place_obj.specials[2];
            Global.PLAYER.x = place_obj.specials[1];
            Global.PLAYER.y = place_obj.specials[2];
            obj.rigid = true;
        };
    } else if (place_obj.type == Global.TYPE.TRANSPORT_DOWN) {
        Global.SPECIAL_OBJ = place_obj;
        place_obj.onCollision = function (obj, dir) {
            obj.rigid = false;
            goDown(place_obj.specials[0]);
            Global.PLAYER.shape.x = Global.BLOCK_SIZE.x * place_obj.specials[1];
            Global.PLAYER.shape.y = Global.BLOCK_SIZE.y * place_obj.specials[2];
            Global.PLAYER.x = place_obj.specials[1];
            Global.PLAYER.y = place_obj.specials[2];
            obj.rigid = true;
        };
    } else if (place_obj.type == Global.TYPE.NPC_FAIRY) {
        place_obj.specials = [0];
        place_obj.onCollision = function (obj, dir) {
            if (place_obj.specials[0] == 0) {
                createDialogStrip([["你醒了"], ["我是这里的仙子，刚才你被这里的小怪打昏了"],
                    ["我可以把我的力量借给你，但是你要帮我找一样东西。"],["一个十字架，中间有一颗红色的宝石。"],
                    ["我去看了下，你的剑被放在三楼，盾被放在五楼，而那个十字架被放在七楼。要到七楼，你得先取回你的剑和盾。我这里还有三把钥匙你先拿去，去吧，勇士！", function () {
                        obj.keys.push({
                            bmp_type: "KEY_YELLOW",
                            type : "KEY_YELLOW"
                        });
                        refreshPlayerKeys();
                        place_obj.shape.x -= Global.BLOCK_SIZE.x;
                    }]
                ]);
                place_obj.specials = [1];
            } else {
                createDialogStrip([["你找到我的十字架了么？", function () {
                }]]);
            }
        };
    } else if (place_obj.type.indexOf("NPC_SHOP") >= 0) {
        place_obj.onCollision = function (obj, dir) {
            createDialogShop(["你需要什么？", "20金币换3点攻击", function () {
                if (obj.pay(20)) {
                    obj.status.ATK += 3;
                    refreshPlayerStatus();
                }
            }]);
        };
    }
    return place_obj;
}

function keyDown(key) {
    if (Global.KEY_BLOCKED || Global.TIME - Global.REF_TIME < 2) return;
    log("");
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
        Global.REF_TIME = Global.TIME;
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
    foreach(Global.TYPE, function(key, value) {
        if (Global.DATA[key] == undefined) {
            Global.DATA[key] = {};
        }
    });

    foreach(Global.TYPE_TO_ID, function(key, value) {
        Global.ID_TO_TYPE[value] = key;
    });

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

function log(msg) {
    (Global.CANVAS.MSG_CANVAS.getChildByName("msg")).text = msg;
}

/*************************************** diaglog functions ****************************/
function showPanel() {
    var textfield = Global.CANVAS.DIALOG_CANVAS.getChildByName('msg');
    textfield.text = "";
    Global.CANVAS.DIALOG_CANVAS.alpha = 1.;
}

function hidePanel() {
    clearButton();
    var textfield = Global.CANVAS.DIALOG_CANVAS.getChildByName('msg');
    textfield.text = "";
    Global.CANVAS.DIALOG_CANVAS.alpha = 0.;
}

function dialog(text, yes_callback, no_callback) {
    var textfield = Global.CANVAS.DIALOG_CANVAS.getChildByName('msg');
    textfield.text = text;
    if (textfield.width > Global.CANVAS.DIALOG_CANVAS.width - 40)
    {
        textfield.multiline = true;
        textfield.wordWrap = true;
        textfield.width = Global.CANVAS.DIALOG_CANVAS.width - 40;
    }
    /*ScriptManager.clearEl();*/
    if (yes_callback != null) {
        ($.createButton({
            x: Global.CANVAS.DIALOG_CANVAS.width - 80,
            y: Global.CANVAS.DIALOG_CANVAS.height - 80,
            parent:Global.CANVAS.DIALOG_CANVAS,
            text:"好",
            onclick: yes_callback,
            lifeTime: 0
        })).name = "yes_but";
    }
    if (no_callback != null) {
        ($.createButton({
            x: Global.CANVAS.DIALOG_CANVAS.width - 80,
            y: Global.CANVAS.DIALOG_CANVAS.height - 40,
            parent:Global.CANVAS.DIALOG_CANVAS,
            text:"不好",
            onclick: no_callback,
            lifeTime: 0
        })).name = "no_but";
    }
}

function clearButton() {
    var to_remove = [];
    for (var i = 0; i<Global.CANVAS.DIALOG_CANVAS.numChildren; i++)
    {
        var child = Global.CANVAS.DIALOG_CANVAS.getChildAt(i);
        if (child.name.indexOf("but") >= 0) {
            to_remove.push(child);
        }
    }

    for (var i = 0; i < to_remove.length; i++) {
        Global.CANVAS.DIALOG_CANVAS.removeChild(to_remove[i]);
    }
}

function createDialogRecur(arr) {
    if (arr.length == 0) {
        hidePanel();
        Global.KEY_BLOCKED = false;
        return;
    }
    var d = arr[0];
    arr.splice(0, 1);
    var yes_call = d.length > 1 ? function () {
        (d[1])();
        clearButton();
        createDialogRecur(arr);
    } : function () {
        clearButton();
        createDialogRecur(arr);
    };
    var no_call = d.length > 2 ?  function () {
        (d[2])();
        clearButton();
        createDialogRecur(arr);
    } : null;
    dialog(d[0], yes_call, no_call);
}

function createDialogStrip(arr) {
    Global.KEY_BLOCKED = true;
    showPanel();
    createDialogRecur(arr);
}

function createDialogShop(arr) {
    var text = arr[0];
    Global.KEY_BLOCKED = true;
    showPanel();
    var textfield = Global.CANVAS.DIALOG_CANVAS.getChildByName('msg');
    textfield.text = text;
    if (textfield.width > Global.CANVAS.DIALOG_CANVAS.width - 40)
    {
        textfield.multiline = true;
        textfield.wordWrap = true;
        textfield.width = Global.CANVAS.DIALOG_CANVAS.width - 40;
    }
    var i = 1;
    while (i < arr.length) {
        var name = "but" + i;
        ($.createButton({
            x: Global.CANVAS.DIALOG_CANVAS.width / 2 - 75,
            y: 50 + Math.floor(i / 2) * 50,
            width : 150,
            parent:Global.CANVAS.DIALOG_CANVAS,
            text: arr[i],
            onclick: arr[i + 1],
            lifeTime: 0
        })).name = name;
        i += 2;
    }
    ($.createButton({
        x: Global.CANVAS.DIALOG_CANVAS.width / 2 - 40,
        y: 50 + Math.floor(i / 2) * 50,
        parent:Global.CANVAS.DIALOG_CANVAS,
        text: "关闭",
        onclick: function () {
            hidePanel();
            Global.KEY_BLOCKED = false;
        },
        lifeTime: 0
    })).name = "but_close";
}

/*************************************** diaglog functions end***************************/

/************************************** item functions begin ******************************/

function refreshPlayerItems() {
    /* clear current items */

    var objs = ObjPool.objects;
    var garbbage = [];
    for (var i = 0; i < objs.length; ++i) {
        var o = objs[i];
        if (o.parent == Global.CANVAS.ITEM_CANVAS) {
            garbbage.push(o);
        }
    }
    for (var i = 0; i < garbbage.length; ++i) {
        garbbage[i].Destroy();
    }

    while (Global.CANVAS.ITEM_CANVAS.numChildren > 0) {
        Global.CANVAS.ITEM_CANVAS.removeChildAt(0);
    }

    var player = Global.PLAYER;
    var x_offset = 20, y_offset = -24;
    for (var i = 0;  i < player.items.length; i++) {
        if (i % 5 == 0) {
            x_offset = 20;
            y_offset += 24;
        }
        var item = player.items[i];
        var obj = createBMPObj(32, 32, item.bmp_type, item.type, 0, 0.6 * Global.MAP_SCALE, Global.CANVAS.ITEM_CANVAS);
        obj.shape.x = x_offset;
        obj.shape.y = y_offset;
        if (item.hasOwnProperty("onClicked")) {
            obj.onClicked = item.onClicked;
        }
        x_offset += 24;

    }
}

function refreshPlayerKeys() {
    /* clear current items */

    var objs = ObjPool.objects;
    var garbbage = [];
    for (var i = 0; i < objs.length; ++i) {
        var o = objs[i];
        if (o.parent == Global.CANVAS.KEY_CANVAS) {
            garbbage.push(o);
        }
    }
    for (var i = 0; i < garbbage.length; ++i) {
        garbbage[i].Destroy();
    }

    while (Global.CANVAS.KEY_CANVAS.numChildren > 0) {
        Global.CANVAS.KEY_CANVAS.removeChildAt(0);
    }

    var player = Global.PLAYER;
    var x_offset = 20, y_offset = -24;
    for (var i = 0;  i < player.keys.length; i++) {
        if (i % 5 == 0) {
            x_offset = 20;
            y_offset += 24;
        }
        var item = player.keys[i];
        var obj = createBMPObj(32, 32, item.bmp_type, item.type, 0, 0.6 * Global.MAP_SCALE, Global.CANVAS.KEY_CANVAS);
        obj.shape.x = x_offset;
        obj.shape.y = y_offset;
        x_offset += 24;
    }
}

/************************************** item functions end ******************************/
/************************************** edit icons ***********************/

function addEditItem(bmp_type, type) {
    var last_page = Global.EDIT_ITEMS[Global.EDIT_ITEMS.length-1];
    if (last_page.length < 18) {
        (Global.EDIT_ITEMS[Global.EDIT_ITEMS.length-1]).push({bmp_type: bmp_type, type : type});
    } else {
        Global.EDIT_ITEMS.push([{bmp_type: bmp_type, type : type}]);
    }
}

function clearCurrEditItems() {
    for (var i = 0; i < Global.CURR_EDIT_OBJS.length; i++) {
        var obj = Global.CURR_EDIT_OBJS[i];
        ScriptManager.popEl(obj.shape);
        obj.Destroy();
    }
    Global.CURR_EDIT_OBJS = [];
}

function loadCurrEditItems() {
    var idx = Global.CURR_EDIT_PAGE_ID;
    var items = Global.EDIT_ITEMS[idx];
    for (var i = 0; i < items.length; i ++) {
        var item = items[i];
        var x = (i % 3) * 50;
        var y = Math.floor(i / 3) * 50;
        Global.CURR_EDIT_OBJS.push(createIcon(item.bmp_type, item.type.toString(), x, y));
    }
}

function nextEditPage() {
    if (Global.CURR_EDIT_PAGE_ID == Global.EDIT_ITEMS.length - 1) return;
    clearCurrEditItems();
    Global.CURR_EDIT_PAGE_ID += 1;
    loadCurrEditItems();
}

function prevEditPage() {
    if (Global.CURR_EDIT_PAGE_ID == 0) return;
    clearCurrEditItems();
    Global.CURR_EDIT_PAGE_ID -= 1;
    loadCurrEditItems();
}

function createIcon(bmp_type, type, x, y) {
    var obj = createBMPObj(32, 32, bmp_type, type, 0, Global.MAP_SCALE, Global.CANVAS.GUI_CANVAS);
    obj.shape.x = x;
    obj.shape.y = y;
    obj.onClicked = function() {
        if (Mouse.target != null && Mouse.target.type == this.type) {
            ScriptManager.popEl(Mouse.target.shape);
            Mouse.Detach();
        } else {
            if (Mouse.target != null && Mouse.target.type != this.type) {
                ScriptManager.popEl(Mouse.target.shape);
                Mouse.Detach();
            }
            var a = createBMPObj(32, 32, this.bmp_type, this.type, 0, Global.MAP_SCALE, 0);
            a.shape.x = (this.absPos()).x;
            a.shape.y = (this.absPos()).y;
            a.shape.alpha = 0.5;
            Mouse.Attach(a);
        }
    };
    return obj;
}

/************************************** edit icons end ***********************/

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

    addEditItem("SLM_GREEN", Global.TYPE.MN_SLM_GREEN);
    addEditItem("NPC001", Global.TYPE.NPC_TRADE);
    addEditItem("KEY_YELLOW", Global.TYPE.KEY_YELLOW);
    addEditItem("KEY_BLUE", Global.TYPE.KEY_BLUE);
    addEditItem("KEY_RED", Global.TYPE.KEY_RED);
    addEditItem("WALL", Global.TYPE.BLK_WALL);
    addEditItem("DOOR_YELLOW", Global.TYPE.DOOR_YELLOW);
    addEditItem("DOOR_BLUE", Global.TYPE.DOOR_BLUE);
    addEditItem("DOOR_RED", Global.TYPE.DOOR_RED);
    addEditItem("GEM_BLUE", Global.TYPE.DEF_UP3);
    addEditItem("GEM_RED", Global.TYPE.ATK_UP3);
    addEditItem("BOTTLE_RED", Global.TYPE.HP_UP200);
    addEditItem("BOTTLE_BLUE", Global.TYPE.HP_UP500);
    addEditItem("SLM_RED", Global.TYPE.MN_SLM_RED);
    addEditItem("SKELETON", Global.TYPE.MN_SKEL_LOW);
    addEditItem("SKELETON_BLUE", Global.TYPE.MN_SKEL_MID);
    addEditItem("MASTER_LOW", Global.TYPE.MN_MASTER_LOW);
    addEditItem("BAT_LOW", Global.TYPE.MN_BAT_LOW);
    addEditItem("TRANSPORT_UP", Global.TYPE.TRANSPORT_UP);
    addEditItem("TRANSPORT_DOWN", Global.TYPE.TRANSPORT_DOWN);
    addEditItem("NPC002", Global.TYPE.NPC_FAIRY);
    addEditItem("LAVA", Global.TYPE.BLK_LAVA);
    addEditItem("VOID", Global.TYPE.BLK_VOID);
    addEditItem("SHOP_A", Global.TYPE.NPC_SHOP_A);
    addEditItem("SHOP_B", Global.TYPE.NPC_SHOP_B);
    addEditItem("SHOP_C", Global.TYPE.NPC_SHOP_C);
    loadCurrEditItems();

    $.createButton({
        x:0,
        y:300,
        parent:Global.CANVAS.GUI_CANVAS,
        text:"上一页",
        onclick:function(){
            prevEditPage();
        },
        lifeTime: 0
    });
    $.createButton({
        x:70,
        y:300,
        parent:Global.CANVAS.GUI_CANVAS,
        text:"下一页",
        onclick:function(){
            nextEditPage();
        },
        lifeTime: 0
    });

    $.createButton({
        x:0,
        y:500,
        parent:Global.CANVAS.GUI_CANVAS,
        text:"切换rigid",
        onclick:function(){
            Global.PLAYER.rigid = !Global.PLAYER.rigid;
        },
        lifeTime: 0
    });

    $.createButton({
        x:0,
        y:530,
        parent:Global.CANVAS.GUI_CANVAS,
        text:"block",
        onclick:function(){
            Global.MOUSE_BLOCKED = !Global.MOUSE_BLOCKED;
        },
        lifeTime: 0
    });

    $.createButton({
        x:0,
        y:420,
        parent:Global.CANVAS.GUI_CANVAS,
        text:"保存",
        onclick:function(){
            Global.SAVE_DATA = saveMaps();
        },
        lifeTime: 0
    });
    $.createButton({
        x:0,
        y:460,
        parent:Global.CANVAS.GUI_CANVAS,
        text:"读取",
        onclick:function(){
            loadMaps(Global.SAVE_DATA);
        },
        lifeTime: 0
    });

    $.createButton({
        x:0,
        y:340,
        parent:Global.CANVAS.GUI_CANVAS,
        text:"上一层",
        onclick:function(){
            saveCurrentMap();
            var idx = Global.FLOOR_IDS.indexOf(Global.CURRENT_FLOOR);
            if (idx == 0) {
                Global.FLOOR_IDS.unshift(Global.CURRENT_FLOOR - 1);
                Global.CURRENT_FLOOR -= 1;
                Global.MAPS.unshift([]);
                loadCurrentMap();
            } else {
                Global.CURRENT_FLOOR = Global.FLOOR_IDS[idx - 1];
                loadCurrentMap();
            }

        },
        lifeTime: 0
    });
    $.createButton({
        x:0,
        y:380,
        parent:Global.CANVAS.GUI_CANVAS,
        text:"下一层",
        onclick:function(){
            saveCurrentMap();
            var idx = Global.FLOOR_IDS.indexOf(Global.CURRENT_FLOOR);
            if (idx == Global.FLOOR_IDS.length - 1) {
                Global.FLOOR_IDS.push(Global.CURRENT_FLOOR + 1);
                Global.CURRENT_FLOOR += 1;
                Global.MAPS.push([]);
                loadCurrentMap();
            } else {
                Global.CURRENT_FLOOR = Global.FLOOR_IDS[idx + 1];
                loadCurrentMap();
            }
        },
        lifeTime: 0
    });

    $.createButton({
        x:70,
        y:380,
        parent:Global.CANVAS.GUI_CANVAS,
        text:"保存base64",
        onclick:function() {
            if (Global.COMM_TEXT_FIELD != undefined) {
                Global.COMM_TEXT_FIELD.text = saveMap2Base64();
            }
        },
        lifeTime: 0
    });

    $.createButton({
        x:70,
        y:420,
        parent:Global.CANVAS.GUI_CANVAS,
        text:"读取base64",
        onclick:function() {
            if (Global.COMM_TEXT_FIELD != undefined) {
                loadMapFromBase64(Global.COMM_TEXT_FIELD.text);
            }
        },
        lifeTime: 0
    });

    $.createButton({
        x:70,
        y:460,
        parent:Global.CANVAS.GUI_CANVAS,
        text:"读取属性",
        onclick:function() {
            if (Global.COMM_TEXT_FIELD != undefined) {
                var properties = (Global.COMM_TEXT_FIELD.text).split(' ');
                Global.SPECIAL_OBJ.specials = [];
                for (var i = 0; i < properties.length; i++) {
                    Global.SPECIAL_OBJ.specials.push(parseInt(properties[i]));
                }
            }
        },
        lifeTime: 0
    });

    var copyTextField = createText('', {
        parent: Global.CANVAS.GUI_CANVAS,
        color: 0xFF3030,
        x: 50,
        y: 340,
        alpha: 1
    });
    copyTextField.autoSize = 'none';
    var format = copyTextField.defaultTextFormat;
    format.align = 'center';
    copyTextField.defaultTextFormat = format;
    copyTextField.width = 100;
    copyTextField.height = 30;
    copyTextField.text = '拖到弹幕框';
    copyTextField.fontsize = 20;
    copyTextField.mouseEnabled = copyTextField.selectable = true;

    copyTextField.addEventListener('focusOut',
        function(e) {
            var textInput = e.relatedObject;
            if (Global.COMM_TEXT_FIELD == undefined) {
                Global.COMM_TEXT_FIELD = textInput;
                trace('logged');
            }
            /*textInput.text = saveMap2Base64();
            textInput.selectAll();*/
        });

    Player.commentTrigger(function(c){
        if (Global.COMM_TEXT_FIELD != undefined) {
            loadMapFromBase64(Global.COMM_TEXT_FIELD.text);
        }
    }, 1 << 31 - 1);
}

function refreshPlayerStatus() {
    (Global.CANVAS.LEFT_STATUS_CANVAS.getChildByName("hp")).text = Global.PLAYER.status.HP + "";
    (Global.CANVAS.LEFT_STATUS_CANVAS.getChildByName("atk")).text = Global.PLAYER.status.ATK + "";
    (Global.CANVAS.LEFT_STATUS_CANVAS.getChildByName("def")).text = Global.PLAYER.status.DEF + "";
    (Global.CANVAS.LEFT_STATUS_CANVAS.getChildByName("gold")).text = Global.PLAYER.status.GOLD + "";
}

function battleFrame(player, monster, turn) {
    if (!turn) {
        if (monster.status.ATK > player.status.DEF) {
            player.status.HP -= monster.status.ATK - player.status.DEF;
        }
        (Global.CANVAS.LEFT_STATUS_CANVAS.getChildByName("hp")).text = player.status.HP + "";
    } else {
        monster.status.HP -= (player.status.ATK - monster.status.DEF) > 0 ? (player.status.ATK - monster.status.DEF) : 1 ;
        if (monster.status.HP < 0) monster.status.HP = 0;
        /*trace(monster.status.HP);*/
        (Global.CANVAS.RIGHT_STATUS_CANVAS.getChildByName("hp")).text = monster.status.HP + "";
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
    createText("当前楼层", {x : 50, y : 20, parent : Global.CANVAS.LEFT_STATUS_CANVAS});
    (createText("1", {x : 130, y : 20, parent : Global.CANVAS.LEFT_STATUS_CANVAS})).name = "floor";

    createText("勇士信息", {x : 30, y : 60, parent : Global.CANVAS.LEFT_STATUS_CANVAS});
    createText("生命", {x : 30, y : 100, parent : Global.CANVAS.LEFT_STATUS_CANVAS});
    createText("攻击", {x : 30, y : 140, parent : Global.CANVAS.LEFT_STATUS_CANVAS});
    createText("防御", {x : 30, y : 180, parent : Global.CANVAS.LEFT_STATUS_CANVAS});
    createText("金币", {x : 30, y : 220, parent : Global.CANVAS.LEFT_STATUS_CANVAS});
    (createText(Global.PLAYER.status.HP + "", {x : 80, y : 100, parent : Global.CANVAS.LEFT_STATUS_CANVAS})).name = "hp";
    (createText(Global.PLAYER.status.ATK + "", {x : 80, y : 140, parent : Global.CANVAS.LEFT_STATUS_CANVAS})).name = "atk";
    (createText(Global.PLAYER.status.DEF + "", {x : 80, y : 180, parent : Global.CANVAS.LEFT_STATUS_CANVAS})).name = "def";
    (createText(Global.PLAYER.status.GOLD + "", {x : 80, y : 220, parent : Global.CANVAS.LEFT_STATUS_CANVAS})).name = "gold";


    createText("怪物信息", {x : 30, y : 60, parent : Global.CANVAS.RIGHT_STATUS_CANVAS});
    createText("生命", {x : 30, y : 100, parent : Global.CANVAS.RIGHT_STATUS_CANVAS});
    createText("攻击", {x : 30, y : 140, parent : Global.CANVAS.RIGHT_STATUS_CANVAS});
    createText("防御", {x : 30, y : 180, parent : Global.CANVAS.RIGHT_STATUS_CANVAS});
    (createText("0", {x : 80, y : 100, parent : Global.CANVAS.RIGHT_STATUS_CANVAS})).name = "hp";
    (createText("0", {x : 80, y : 140, parent : Global.CANVAS.RIGHT_STATUS_CANVAS})).name = "atk";
    (createText("0", {x : 80, y : 180, parent : Global.CANVAS.RIGHT_STATUS_CANVAS})).name = "def";

    /* item panel */
    Global.CANVAS.ITEM_CANVAS = createCanvas({
        x: 0,
        y: Player.height / 2,
        lifeTime: 0
    });

    /* key panel */
    Global.CANVAS.KEY_CANVAS = createCanvas({
        x: Player.width/2 + Global.MAP_SIZE.x/2 * Global.BLOCK_SIZE.x,
        y: Player.height / 2,
        lifeTime: 0
    });
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

    Global.CANVAS.MSG_CANVAS = createCanvas({
        x: 0,
        y: (Global.MAP_SIZE.y - 1) * Global.BLOCK_SIZE.y,
        lifeTime: 0
    });

    (createText("", {x : 10, y : 15, parent : Global.CANVAS.MSG_CANVAS})).name = "msg";

    var margin = (Player.width - Global.MAP_SIZE.x * Global.BLOCK_SIZE.x) / 2;
    Global.CANVAS.DIALOG_CANVAS = createCanvas({
        x: margin + Global.MAP_SIZE.x / 4 * Global.BLOCK_SIZE.x,
        y: Global.MAP_SIZE.y / 4 * Global.BLOCK_SIZE.y,
        lifeTime: 0
    });

    (createRectangle(Global.CANVAS.DIALOG_CANVAS, 0x333333, Global.MAP_SIZE.x / 2 * Global.BLOCK_SIZE.x, Global.MAP_SIZE.y / 2 * Global.BLOCK_SIZE.y));
    (createText("", {x : 10, y : 15, parent : Global.CANVAS.DIALOG_CANVAS})).name = 'msg';

    hidePanel();

    /*Global.CANVAS.DIALOG_CANVAS.alpha = 0;*/


    Global.CANVAS.RIGHT_STATUS_CANVAS = createCanvas({
        x: Player.width/2 + Global.MAP_SIZE.x/2 * Global.BLOCK_SIZE.x,
        y: 0,
        lifeTime: 0
    });

    initMap();
    initPlayer();

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
