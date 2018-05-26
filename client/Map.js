/**
 * Created by Jerome on 12-01-18.
 */
var Map = new Phaser.Class({

    Extends: CustomSprite,

    initialize: function Map(x, y, viewW, viewH, target, dragWidth, dragHeight) {
        CustomSprite.call(this, UI.scene, x, y, 'fullmap');

        this.setDepth(2);
        this.setScrollFactor(0);
        this.setVisible(false);

        this.viewRect = new Phaser.Geom.Rectangle(this.x-viewW/2,this.y-viewH/2,viewW,viewH);

        this.target = target;
        this.toponyms = [];
        Engine.settlementsData.forEach(function(s){
            this.addText(s);
        },this);

        this.setInteractive();
        UI.scene.input.setDraggable(this);
        this.dragWidth = (dragWidth > -1 ? dragWidth : 999999);
        this.dragHeight = (dragHeight > -1 ? dragHeight : 999999);
        this.draggedX = 0;
        this.draggedY = 0;

        this.on('drag',this.handleDrag.bind(this));
        this.on('pointerup',this.handleClick.bind(this));

        this.pins = [];
        this.resetCounter();
        this.clickedTile = null;

    },

    addMask: function(texture){
        var mask = UI.scene.add.sprite(this.x,this.y,texture);
        mask.setVisible(false);
        //mask.setScale(1.1);
        if(Boot.WEBGL){
            mask.setDepth(2);
            mask.setScrollFactor(0);
            this.mask = new Phaser.Display.Masks.BitmapMask(UI.scene,mask);
            this.maskOverlay = mask;
        }else{
            var shape = UI.scene.make.graphics();
            shape.fillStyle('#ffffff');
            var w = mask.frame.width;
            var h = mask.frame.height;
            shape.fillRect(this.x-(w/2), this.y-(h/2), w, h);
            this.mask = new Phaser.Display.Masks.GeometryMask(UI.scene, shape);
            this.maskOverlay = shape;
        }
        this.maskOverlay.setVisible(false);
        this.maskSize = {
            width: mask.frame.width,
            height: mask.frame.height
        };

        this.toponyms.forEach(function(toponym){
            toponym.mask = (Boot.WEBGL
                    ? new Phaser.Display.Masks.BitmapMask(UI.scene,this.maskOverlay)
                    : new Phaser.Display.Masks.GeometryMask(UI.scene, this.maskOverlay)
            );
        },this);
    },

    addText: function(settlement){
        var text = UI.scene.add.text(0, 0, settlement.name,{font: '60px treamd', fill: '#966f33', stroke: '#000000', strokeThickness: 3});
        text.tx = settlement.x;
        text.ty = settlement.y;
        text.setDepth(3);
        text.setVisible(false);
        text.setScrollFactor(0,0);
        text.setAlpha(0.5);
        text.setOrigin(0.5);
        this.toponyms.push(text);
    },

    handleDrag: function(pointer,x,y){
        // TODO: check for Phaser way of restricting distance
        if(x < this.minX) return;
        if(x > this.maxX) return;
        if(y < this.minY) return;
        if(y > this.maxY) return;
        var dx = this.x - x;
        var dy = this.y - y;
        this.x = x;
        this.y = y;
        this.dragMap(dx,dy,false);
    },

    dragMap: function(dx,dy,tween){ // x and y are destination coordinates
        // Used to keep track of the current center of the map
        this.draggedX += dx;
        this.draggedY += dy;

        if(tween){
            var targets = this.pins.concat([this.text,this]).concat(this.toponyms);
            var duration = 300;
            UI.scene.tweens.add({
                    targets: targets,
                    x: '-='+dx,
                    y: '-='+dy,
                    duration: duration
                });
            UI.scene.tweens.add({
                targets: this.input.hitArea,
                x: '+='+dx,
                y: '+='+dy,
                duration: duration
            });
        }else {
            this.input.hitArea.x += dx;
            this.input.hitArea.y += dy;
            this.moveTexts(dx,dy);
            this.movePins(dx, dy);
        }
    },

    movePins: function(dx,dy){
        this.pins.forEach(function(p){
            p.x -= dx;
            p.y -= dy;
        });
    },

    moveTexts: function(dx,dy){
        this.toponyms.forEach(function(p){
            p.x -= dx;
            p.y -= dy;
        });
    },

    handleClick: function(pointer){
        console.log('click');
        if(pointer.downX != pointer.upX || pointer.downY != pointer.upY) return; // drag
        console.log(Utils.screenToMap(pointer.x,pointer.y,this));
    },

    getNextPin: function(){
        if(this.pinsCounter >= this.pins.length) this.pins.push(new Pin(this,this.maskOverlay));
        return this.pins[this.pinsCounter++];
    },

    // Maps a tile coordinate to % coordinate on the map
    computeMapLocation: function(tx,ty){
        var pct = Utils.tileToPct(tx,ty);
        var dx = (pct.x - this.originX)*this.width;
        var dy = (pct.y - this.originY)*this.height;
        return {
            x: Math.round(this.x+dx),
            y: Math.round(this.y+dy)
        }
    },

    addPin: function(x,y,name,texture){
        var location = this.computeMapLocation(x,y);
        var pin = this.getNextPin();
        pin.setUp(x,y,location.x,location.y,name,texture);
        return pin;
    },

    focus: function(x,y){
        var dx = x - (this.x + this.draggedX);
        var dy = y - (this.y + this.draggedY);
        // The map has to move in the opposite direction of the drag (w.r.t. center)
        this.dragMap(dx,dy,true);
    },

    resetCounter: function(){
        this.pinsCounter = 0;
    },

    display: function(x,y){
        var tile;
        if(this.target == 'building'){
            tile = Engine.currentBuiling.getTilePosition();
        }else{
            tile = Engine.player.getTilePosition();
        }
        var origin = Utils.tileToPct(tile.x,tile.y);
        this.setOrigin(origin.x,origin.y);
        this.setPosition(x,y);

        if(this.target == 'player') {
            this.centerPin = this.addPin(tile.x,tile.y,'Your position','x');
            this.centerPin.noDrag = true;
            Engine.player.markers.forEach(function(data){
                this.addPin(data.x,data.y,Engine.buildingsData[data.type].name);
            },this);
        }

        this.minY = this.y - (this.height-this.displayOriginY) + this.maskSize.height/2;
        this.maxY = this.y + this.displayOriginY - this.maskSize.height/2;
        this.minX = this.x - (this.width-this.displayOriginX) + this.maskSize.width/2;
        this.maxX = this.x + this.displayOriginX - this.maskSize.width/2;

        this.minX = Math.max(this.minX,this.x-this.dragWidth);
        this.maxX = Math.min(this.maxX,this.x+this.dragWidth);
        this.minY = Math.max(this.minY,this.y-this.dragHeight);
        this.maxY = Math.min(this.maxY,this.y+this.dragHeight);

        this.toponyms.forEach(function(t){
            var location = this.computeMapLocation(t.tx,t.ty);
            t.setPosition(location.x,location.y);
            t.setVisible(true);
        },this);

        var rectx = (this.width*origin.x)-(this.viewRect.width/2);
        var recty = (this.height*origin.y)-(this.viewRect.height/2);
        this.input.hitArea = new Phaser.Geom.Rectangle(rectx,recty,this.viewRect.width,this.viewRect.height);

        this.setVisible(true);
        if(!Boot.WEBGL) this.maskOverlay.setVisible(true);
    },

    hide: function(){
        this.hidePins();
        this.toponyms.forEach(function(t){
            t.setVisible(false);
        });
        this.setVisible(false);
        this.maskOverlay.setVisible(false);
    },

    hidePins: function(){
        this.resetCounter();
        this.pins.forEach(function(p){
            p.setVisible(false);
        });
    }
});

var Pin = new Phaser.Class({

    Extends: CustomSprite,

    initialize: function Pin (map,mask) {
        CustomSprite.call(this, UI.scene, 0, 0, 'pin');
        this.setDepth(5);
        this.setScrollFactor(0);
        this.setOrigin(0.5,1);
        this.setVisible(false);
        this.setInteractive();
        this.mask = (Boot.WEBGL
                ? new Phaser.Display.Masks.BitmapMask(UI.scene,mask)
                : new Phaser.Display.Masks.GeometryMask(UI.scene,mask)
        );
        this.parentMap = map;
        this.on('pointerover',this.handleOver.bind(this));
        this.on('pointerout',this.handleOut.bind(this));
    },

    setUp: function(tileX,tileY,x,y,name,texture){
        if(texture) this.setTexture(texture);
        this.tileX = tileX;
        this.tileY = tileY;
        this.setPosition(x,y);
        this.name = name;
        this.setVisible(true);
    },

    highlight: function(){
        this.setTexture('redpin');
    },

    unhighlight: function(){
        this.setTexture('pin');
    },

    focus: function(){
        this.parentMap.focus(this.x,this.y);
    },

    handleOver: function(){
        if(!this.parentMap.viewRect.contains(this.x,this.y)) return;
        UI.tooltip.updateInfo(this.name);
        UI.tooltip.display();
    },

    handleOut: function(){
        UI.tooltip.hide();
    },

    hide: function(){
        this.setVisible(false);
    }
});