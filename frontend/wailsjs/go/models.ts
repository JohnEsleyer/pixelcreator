export namespace main {
	
	export class PackResult {
	    sheet: models.PixelFrame;
	    selections: models.SpriteSelection[];
	
	    static createFrom(source: any = {}) {
	        return new PackResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sheet = this.convertValues(source["sheet"], models.PixelFrame);
	        this.selections = this.convertValues(source["selections"], models.SpriteSelection);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace models {
	
	export class Color {
	    r: number;
	    g: number;
	    b: number;
	    a: number;
	
	    static createFrom(source: any = {}) {
	        return new Color(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.r = source["r"];
	        this.g = source["g"];
	        this.b = source["b"];
	        this.a = source["a"];
	    }
	}
	export class Group {
	    id: string;
	    name: string;
	    color: string;
	
	    static createFrom(source: any = {}) {
	        return new Group(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.color = source["color"];
	    }
	}
	export class PixelFrame {
	    id: string;
	    width: number;
	    height: number;
	    pixels: Color[];
	    groupId: string;
	    tag?: string;
	
	    static createFrom(source: any = {}) {
	        return new PixelFrame(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.pixels = this.convertValues(source["pixels"], Color);
	        this.groupId = source["groupId"];
	        this.tag = source["tag"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Project {
	    id: number;
	    name: string;
	    width: number;
	    height: number;
	    groups: Group[];
	    frames: PixelFrame[];
	    activeGroupId: string;
	    currentFrameIndexInGroup: number;
	    fps: number;
	    onionSkinEnabled: boolean;
	    zoom: number;
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.groups = this.convertValues(source["groups"], Group);
	        this.frames = this.convertValues(source["frames"], PixelFrame);
	        this.activeGroupId = source["activeGroupId"];
	        this.currentFrameIndexInGroup = source["currentFrameIndexInGroup"];
	        this.fps = source["fps"];
	        this.onionSkinEnabled = source["onionSkinEnabled"];
	        this.zoom = source["zoom"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SpriteSelection {
	    id: number;
	    x: number;
	    y: number;
	    width: number;
	    height: number;
	    groupName: string;
	    enabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SpriteSelection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.x = source["x"];
	        this.y = source["y"];
	        this.width = source["width"];
	        this.height = source["height"];
	        this.groupName = source["groupName"];
	        this.enabled = source["enabled"];
	    }
	}

}

