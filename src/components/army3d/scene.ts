import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { FIELD_H, FIELD_W, type BattleEvent, type BattleState, type Unit } from "@/lib/armyBattle";
import type { Side } from "@/lib/battle";

// Le rendu 3D de « Battle 2 ». Il ne décide de rien : le moteur de
// `armyBattle.ts` avance, et cette scène relit ses unités à chaque image —
// des pions et des fous tournés au tour, un InstancedMesh par camp et par
// pièce, qui tombent à terre quand ils meurent et y restent. Chargée à la
// demande par `ArmyBattlefield`, pour que three.js ne pèse que sur cette page.

/** Un pixel du moteur vaut un dixième d'unité de la scène : le champ fait 96 × 44. */
const S = 0.1;
const SIDE_HEX: Record<Side, number> = { left: 0xe8622a, right: 0x3987e5 };
const HORIZON = 0x0c1319;
const FALL_FRAMES = 16;
const SPARKS = 900;
const LABELS = 14;

function toWorld(x: number, y: number): [number, number] {
  return [(x - FIELD_W / 2) * S, (y - FIELD_H / 2) * S];
}

// Profils tournés : un pion, et un fou plus élancé pour les cavaliers.
function latheFrom(points: [number, number][], head: { y: number; r: number } | null, scale: number): THREE.LatheGeometry {
  const pts = points.map(([r, y]) => new THREE.Vector2(r * scale, y * scale));
  if (head) {
    for (let i = 0; i <= 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * Math.PI;
      pts.push(new THREE.Vector2(Math.max(0.001, Math.cos(a) * head.r * scale), (head.y + Math.sin(a) * head.r) * scale));
    }
  }
  const geometry = new THREE.LatheGeometry(pts, 24);
  geometry.computeVertexNormals();
  return geometry;
}

function pawnGeometry() {
  return latheFrom(
    [
      [0.001, 0],
      [0.78, 0],
      [0.78, 0.14],
      [0.66, 0.22],
      [0.58, 0.34],
      [0.4, 0.52],
      [0.3, 0.98],
      [0.46, 1.06],
      [0.46, 1.14],
      [0.24, 1.2],
    ],
    { y: 1.52, r: 0.34 },
    1.25,
  );
}

function riderGeometry() {
  return latheFrom(
    [
      [0.001, 0],
      [0.84, 0],
      [0.84, 0.15],
      [0.7, 0.24],
      [0.6, 0.38],
      [0.36, 0.62],
      [0.26, 1.3],
      [0.5, 1.38],
      [0.5, 1.46],
      [0.3, 1.52],
      [0.42, 1.78],
      [0.36, 2.04],
      [0.16, 2.24],
      [0.001, 2.34],
    ],
    null,
    1.2,
  );
}

function canvasTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d")!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Le sol : un damier très sombre, quadrillé, avec une lueur de chaque camp.
function groundTexture() {
  return canvasTexture(2048, 1024, (ctx) => {
    ctx.fillStyle = "#0b1117";
    ctx.fillRect(0, 0, 2048, 1024);
    const cell = 2048 / 24;
    for (let i = 0; i < 24; i++) {
      for (let j = 0; j < 12; j++) {
        if ((i + j) % 2) continue;
        ctx.fillStyle = "#0e161d";
        ctx.fillRect(i * cell, j * cell * (1024 / 1024), cell, cell);
      }
    }
    ctx.strokeStyle = "rgba(90,120,140,0.12)";
    ctx.lineWidth = 2;
    for (let i = 0; i <= 24; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, 1024);
      ctx.stroke();
    }
    for (let j = 0; j <= 12; j++) {
      ctx.beginPath();
      ctx.moveTo(0, j * cell);
      ctx.lineTo(2048, j * cell);
      ctx.stroke();
    }
    // Les bords se fondent dans la couleur du fond : le plateau n'a pas de
    // tranche visible, il s'efface dans le brouillard.
    for (const [x0, y0, x1, y1] of [
      [0, 0, 0, 220],
      [0, 1024, 0, 804],
      [0, 0, 260, 0],
      [2048, 0, 1788, 0],
    ] as const) {
      const fade = ctx.createLinearGradient(x0, y0, x1, y1);
      fade.addColorStop(0, "rgba(10,15,20,1)");
      fade.addColorStop(1, "rgba(10,15,20,0)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, 2048, 1024);
    }
    for (const [x, color] of [
      [0, "rgba(232,98,42,0.22)"],
      [2048, "rgba(57,135,229,0.22)"],
    ] as const) {
      const g = ctx.createRadialGradient(x, 512, 0, x, 512, 900);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 2048, 1024);
    }
  });
}

function labelTexture() {
  return canvasTexture(256, 64, (ctx) => {
    ctx.font = "900 40px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(12,17,22,0.9)";
    ctx.strokeText("REFUND!", 128, 34);
    ctx.fillStyle = "#fab219";
    ctx.fillText("REFUND!", 128, 34);
  });
}

type Slot = { mesh: THREE.InstancedMesh; index: number };

type UnitLook = {
  prevX: number;
  prevY: number;
  /** Image à laquelle il est tombé, -1 tant qu'il tient debout. */
  fellAt: number;
  fallDir: number;
  phase: number;
};

type Spark = { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; r: number; g: number; b: number };

export class ArmyScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.5, 600);
  private controls: OrbitControls;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private world = new THREE.Group();
  private pieces = new THREE.Group();
  private meshes: THREE.InstancedMesh[] = [];
  private slots = new Map<number, Slot>();
  private looks = new Map<number, UnitLook>();
  private pawn = pawnGeometry();
  private rider = riderGeometry();
  private material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.18 });
  private sparks: Spark[] = [];
  private sparkGeometry = new THREE.BufferGeometry();
  private labels: { sprite: THREE.Sprite; life: number }[] = [];
  private frameCount = 0;
  private shake = 0;
  /** Vrai dès que le lecteur a pris la caméra en main : on ne la recadre plus. */
  private userCamera = false;
  private frameDistance = 60;
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();
  private white = new THREE.Color(0xffffff);
  private grey = new THREE.Color(0x5f7481);
  private dark = new THREE.Color(0x151c22);
  private disposables: { dispose: () => void }[] = [];
  private reflector: Reflector;
  private covers: Record<Side, THREE.Group> = { left: new THREE.Group(), right: new THREE.Group() };
  private chads: Partial<Record<Side, THREE.Mesh>> = {};
  private winner: Side | null = null;
  private loader = new THREE.TextureLoader();
  private clock = new THREE.Clock();
  private versus: THREE.Mesh;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    // Fond et brouillard d'une même teinte : sol et ciel se rejoignent sans
    // ligne d'horizon.
    this.scene.background = new THREE.Color(HORIZON);
    this.scene.fog = new THREE.Fog(HORIZON, 60, 150);
    this.scene.add(this.world);
    this.world.add(this.pieces);

    // Lumière : un ciel froid, un soleil qui porte les ombres, et un contre-jour
    // de la couleur de chaque camp derrière ses lignes.
    this.world.add(new THREE.HemisphereLight(0x9fb2bd, 0x05080b, 0.7));
    const sun = new THREE.DirectionalLight(0xfff1e6, 2.2);
    sun.position.set(-18, 46, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -58;
    sun.shadow.camera.right = 58;
    sun.shadow.camera.top = 34;
    sun.shadow.camera.bottom = -34;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    this.world.add(sun);
    for (const [side, x] of [
      ["left", -62],
      ["right", 62],
    ] as const) {
      const rim = new THREE.PointLight(SIDE_HEX[side], 900, 110, 1.6);
      rim.position.set(x, 9, 0);
      this.world.add(rim);
    }

    // Le sol : un miroir sombre, et par-dessus le plateau quadrillé, à peine
    // translucide — de quoi laisser voir un reflet des jaquettes et des pièces
    // sans transformer le champ en patinoire.
    this.reflector = new Reflector(new THREE.PlaneGeometry(900, 900), {
      textureWidth: 512,
      textureHeight: 512,
      color: 0x46515a,
      clipBias: 0.003,
    });
    this.reflector.rotation.x = -Math.PI / 2;
    this.reflector.position.y = -0.03;
    this.world.add(this.reflector);

    const groundTex = groundTexture();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD_W * S * 1.5, FIELD_H * S * 2.4),
      new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.9, metalness: 0, transparent: true, opacity: 0.72 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.world.add(ground);
    // Au-delà du plateau, un voile de la couleur du fond, plus opaque : le
    // reflet s'y éteint en allant vers l'horizon.
    const veil = new THREE.Mesh(
      new THREE.RingGeometry(40, 450, 64),
      new THREE.MeshStandardMaterial({ color: HORIZON, roughness: 0.95, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    veil.rotation.x = -Math.PI / 2;
    veil.position.y = -0.01;
    this.world.add(veil);
    this.disposables.push(groundTex, veil.geometry, veil.material as THREE.Material);

    // La ligne de front : assez lumineuse pour que le bloom la fasse briller.
    const lineTex = canvasTexture(8, 256, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, "rgba(232,98,42,0)");
      g.addColorStop(0.2, "#ff7a45");
      g.addColorStop(0.5, "#ffffff");
      g.addColorStop(0.8, "#3987e5");
      g.addColorStop(1, "rgba(57,135,229,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 8, 256);
    });
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, FIELD_H * S * 1.2),
      new THREE.MeshBasicMaterial({ map: lineTex, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.02;
    this.world.add(line);

    // Les étincelles.
    this.sparkGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
    this.sparkGeometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
    this.sparkGeometry.setDrawRange(0, 0);
    const sparkMaterial = new THREE.PointsMaterial({
      size: 0.42,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.world.add(new THREE.Points(this.sparkGeometry, sparkMaterial));

    const labelTex = labelTexture();
    const labelMaterial = new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthWrite: false, depthTest: false });
    for (let i = 0; i < LABELS; i++) {
      const sprite = new THREE.Sprite(labelMaterial.clone());
      sprite.scale.set(5, 1.25, 1);
      sprite.visible = false;
      this.world.add(sprite);
      this.labels.push({ sprite, life: 0 });
    }

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.25;
    this.controls.minDistance = 30;
    this.controls.maxDistance = 180;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.35;
    // La molette ne doit pas voler le défilement de la page.
    this.controls.enableZoom = false;
    this.controls.addEventListener("start", () => {
      this.controls.autoRotate = false;
      this.userCamera = true;
    });

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.5, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.disposables.push(this.pawn, this.rider, this.material, lineTex, labelTex, sparkMaterial, this.sparkGeometry);

    for (const side of ["left", "right"] as const) this.world.add(this.covers[side]);

    const versusTex = canvasTexture(256, 256, (ctx) => {
      const g = ctx.createLinearGradient(0, 40, 0, 216);
      g.addColorStop(0, "#ffd3bf");
      g.addColorStop(0.5, "#ff7a45");
      g.addColorStop(1, "#e8622a");
      ctx.font = "italic 900 150px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = g;
      ctx.fillText("VS", 128, 132);
    });
    this.versus = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({ map: versusTex, transparent: true, depthWrite: false, fog: false, toneMapped: false }),
    );
    this.versus.position.set(0, 8.5, -FIELD_H * S * 0.5 - 8.6);
    this.versus.visible = false;
    this.world.add(this.versus);
    this.disposables.push(versusTex, this.versus.geometry, this.versus.material as THREE.Material);
  }

  /**
   * Les deux jaquettes, côte à côte au fond de l'arène et face à la caméra,
   * comme l'écran géant d'un stade, un « VS » entre elles. Elles passent par
   * l'optimiseur d'images de Next — même origine, donc pas de souci CORS pour
   * en faire une texture WebGL — et, s'il échoue, par l'URL d'origine. Une
   * jaquette introuvable disparaît plutôt que de laisser un rectangle noir.
   */
  setCovers(urls: Record<Side, string | null>) {
    for (const side of ["left", "right"] as const) {
      const group = this.covers[side];
      this.clearGroup(group);
      delete this.chads[side];
      const url = urls[side];
      if (!url) continue;

      const h = 17;
      const w = (h * 2) / 3;
      const dir = side === "left" ? -1 : 1;
      group.visible = false;
      group.position.set(dir * (w / 2 + 3.2), 0.3, -FIELD_H * S * 0.5 - 9);
      // Un soupçon d'angle vers le centre, pour que les deux se regardent.
      group.rotation.y = -dir * 0.12;

      // Un liseré lumineux de la couleur du camp, que le bloom fait briller.
      const frame = new THREE.Mesh(
        new THREE.PlaneGeometry(w + 0.7, h + 0.7),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(SIDE_HEX[side]).multiplyScalar(1.6), toneMapped: false }),
      );
      frame.position.set(0, h / 2, -0.05);
      group.add(frame);

      const material = new THREE.MeshBasicMaterial({ color: 0xd8d8d8, fog: false });
      const cover = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
      cover.position.set(0, h / 2, 0);
      group.add(cover);

      const show = (texture: THREE.Texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        material.map = texture;
        material.needsUpdate = true;
        group.visible = true;
      };
      // q=75 : la seule qualité que l'optimiseur accepte sans `images.qualities`.
      this.loader.load(`/_next/image?url=${encodeURIComponent(url)}&w=640&q=75`, show, undefined, () => {
        this.loader.setCrossOrigin("anonymous");
        this.loader.load(url, show, undefined, () => {
          group.visible = false;
        });
      });

      const chadTexture = this.loader.load("/chad.png");
      chadTexture.colorSpace = THREE.SRGBColorSpace;
      const chad = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: chadTexture, transparent: true, opacity: 0, fog: false, depthWrite: false }),
      );
      chad.position.set(0, h / 2, 0.05);
      chad.visible = false;
      group.add(chad);
      this.chads[side] = chad;
    }
    this.versus.visible = Boolean(urls.left && urls.right);
  }

  private clearGroup(group: THREE.Group) {
    for (const child of [...group.children]) {
      group.remove(child);
      const mesh = child as THREE.Mesh;
      mesh.geometry.dispose();
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.map?.dispose();
      material.dispose();
    }
  }

  /** Le Chad apparaît en fondu sur la jaquette du vainqueur, comme sur `/battle`. */
  setWinner(side: Side | null) {
    this.winner = side;
    this.clock.start();
    for (const s of ["left", "right"] as const) {
      const chad = this.chads[s];
      if (chad) chad.visible = s === side;
    }
  }

  /** Redéploie les pièces pour une nouvelle bataille. */
  load(state: BattleState) {
    for (const mesh of this.meshes) {
      this.pieces.remove(mesh);
      mesh.dispose();
    }
    this.meshes = [];
    this.slots.clear();
    this.looks.clear();
    this.sparks = [];
    this.shake = 0;
    this.setWinner(null);
    for (const label of this.labels) {
      label.life = 0;
      label.sprite.visible = false;
    }

    for (const side of ["left", "right"] as const) {
      for (const rider of [false, true]) {
        const units = state.units.filter((u) => u.side === side && u.rider === rider);
        if (units.length === 0) continue;
        const mesh = new THREE.InstancedMesh(rider ? this.rider : this.pawn, this.material, units.length);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        units.forEach((u, index) => {
          this.slots.set(u.id, { mesh, index });
          mesh.setColorAt(index, this.color.setHex(SIDE_HEX[side]));
        });
        this.meshes.push(mesh);
        this.pieces.add(mesh);
      }
    }
    for (const u of state.units) {
      this.looks.set(u.id, { prevX: u.x, prevY: u.y, fellAt: -1, fallDir: u.side === "left" ? 1 : -1, phase: (u.id * 0.618) % 1 });
    }
    this.frame(state, []);
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.bloom.resolution.set(width, height);
    const ratio = Math.min(window.devicePixelRatio || 1, 2) * 0.5;
    this.reflector.getRenderTarget().setSize(Math.round(width * ratio), Math.round(height * ratio));
    this.camera.aspect = width / height;
    // Le champ doit tenir en largeur : on recule la caméra selon le cadre.
    // Même angle partout, P1 à gauche et P2 à droite comme dans un jeu de
    // combat ; sur un écran étroit, c'est le recadrage automatique qui
    // rapproche la caméra de la mêlée.
    // Sur un cadre plus haut que large, montrer le champ entier rendrait les
    // pièces minuscules : on cadre plus serré, et les armées entrent par les
    // bords en marchant.
    const span = this.camera.aspect < 1.2 ? 62 : FIELD_W * S * 1.02;
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const distance = Math.max(span / 2 / Math.tan(hfov / 2), 40) * 1.06;
    // Assez rasant pour voir les pièces de profil, assez haut pour lire la mêlée.
    const polar = 1.0;
    this.camera.position.set(0, distance * Math.cos(polar), distance * Math.sin(polar));
    // Visée un peu au-dessus et en arrière du centre : les jaquettes du fond
    // entrent dans le cadre sans décentrer la mêlée.
    this.controls.target.set(0, 2, -3);
    this.frameDistance = distance;
    this.controls.autoRotate = false;
    this.controls.maxDistance = distance * 1.6;
    this.controls.minDistance = Math.min(24, distance * 0.4);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  private place(u: Unit, look: UnitLook, slot: Slot) {
    const [wx, wz] = toWorld(u.x, u.y);
    const d = this.dummy;
    d.position.set(wx, 0, wz);
    d.rotation.set(0, 0, 0);
    d.scale.setScalar(1);

    if (u.status === "fled") {
      d.scale.setScalar(0.0001);
    } else if (u.status === "dead") {
      if (look.fellAt < 0) look.fellAt = this.frameCount;
      const t = Math.min(1, (this.frameCount - look.fellAt) / FALL_FRAMES);
      // Chute avec un petit rebond, vers l'arrière de son propre camp.
      const eased = t < 1 ? 1 - (1 - t) ** 3 : 1;
      d.rotation.z = look.fallDir * eased * (Math.PI / 2) * (t < 1 ? 1 : 1);
      d.rotation.y = look.phase * Math.PI * 2;
      d.position.y = 0.7 * eased;
    } else {
      const moved = Math.hypot(u.x - look.prevX, u.y - look.prevY);
      const t = this.frameCount * 0.35 + look.phase * 10;
      // Les pièces qui marchent sautillent et penchent vers l'avant.
      const hop = moved > 0.05 ? Math.abs(Math.sin(t)) * 0.35 : 0;
      d.position.y = hop;
      if (moved > 0.05) {
        const ang = Math.atan2(u.y - look.prevY, u.x - look.prevX);
        d.rotation.set(0, -ang, 0);
        d.rotateZ(-0.07);
      }
      if (u.flash > 0) d.scale.set(1.12, 0.9, 1.12);
    }
    d.updateMatrix();
    slot.mesh.setMatrixAt(slot.index, d.matrix);

    const base = this.color.setHex(SIDE_HEX[u.side]);
    if (u.status === "dead") base.lerp(this.dark, 0.7);
    else if (u.status === "fleeing") base.lerp(this.grey, 0.65);
    else if (u.flash > 0) base.lerp(this.white, 0.85);
    slot.mesh.setColorAt(slot.index, base);

    look.prevX = u.x;
    look.prevY = u.y;
  }

  private emit(events: BattleEvent[]) {
    for (const e of events) {
      const [wx, wz] = toWorld(e.x, e.y);
      if (e.type === "miss") continue;
      if (e.type === "flee") {
        const label = this.labels.find((l) => l.life <= 0);
        if (label) {
          label.life = 70;
          label.sprite.position.set(wx, 3.2, wz);
          label.sprite.visible = true;
        }
        continue;
      }
      const kill = e.type === "kill";
      if (kill) this.shake = Math.min(1, this.shake + 0.35);
      const tint = kill ? new THREE.Color(SIDE_HEX[e.side]).multiplyScalar(2.2) : new THREE.Color(2.4, 2.2, 1.8);
      const n = kill ? 22 : 5;
      for (let i = 0; i < n && this.sparks.length < SPARKS; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = (kill ? 0.18 : 0.1) + Math.random() * (kill ? 0.3 : 0.14);
        this.sparks.push({
          x: wx,
          y: 1.2,
          z: wz,
          vx: Math.cos(a) * v,
          vy: 0.12 + Math.random() * (kill ? 0.3 : 0.15),
          vz: Math.sin(a) * v,
          life: kill ? 40 : 20,
          r: tint.r,
          g: tint.g,
          b: tint.b,
        });
      }
    }
  }

  private updateSparks() {
    const pos = this.sparkGeometry.getAttribute("position") as THREE.BufferAttribute;
    const col = this.sparkGeometry.getAttribute("color") as THREE.BufferAttribute;
    let n = 0;
    const alive: Spark[] = [];
    for (const s of this.sparks) {
      s.x += s.vx;
      s.y += s.vy;
      s.z += s.vz;
      s.vy -= 0.018;
      if (s.y < 0.05) {
        s.y = 0.05;
        s.vy *= -0.35;
        s.vx *= 0.6;
        s.vz *= 0.6;
      }
      if (--s.life <= 0) continue;
      alive.push(s);
      const fade = Math.min(1, s.life / 18);
      pos.setXYZ(n, s.x, s.y, s.z);
      col.setXYZ(n, s.r * fade, s.g * fade, s.b * fade);
      n++;
    }
    this.sparks = alive;
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.sparkGeometry.setDrawRange(0, n);
  }

  /** Une image : relit l'état du moteur, joue les effets, et dessine. */
  frame(state: BattleState, events: BattleEvent[]) {
    this.frameCount++;
    for (const u of state.units) {
      const slot = this.slots.get(u.id);
      const look = this.looks.get(u.id);
      if (slot && look) this.place(u, look, slot);
    }
    for (const mesh of this.meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    this.emit(events);
    this.updateSparks();
    for (const label of this.labels) {
      if (label.life <= 0) continue;
      label.life--;
      label.sprite.position.y += 0.05;
      (label.sprite.material as THREE.SpriteMaterial).opacity = Math.min(1, label.life / 25);
      if (label.life <= 0) label.sprite.visible = false;
    }

    // Le sol tremble à chaque mort, et se calme vite.
    if (this.shake > 0.001) {
      const a = this.shake * 0.45;
      this.world.position.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a * 0.5, (Math.random() - 0.5) * a);
      this.shake *= 0.86;
    } else {
      this.world.position.set(0, 0, 0);
    }

    if (this.winner) {
      const chad = this.chads[this.winner];
      if (chad) {
        // Le même cycle que `.animate-chad-blink` : 10 s, apparition puis retrait.
        const t = (this.clock.getElapsedTime() % 10) / 10;
        (chad.material as THREE.MeshBasicMaterial).opacity = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
      }
    }

    if (!this.userCamera) this.autoFrame(state);
    this.controls.update();
    this.composer.render();
  }

  // La caméra suit la mêlée : visée sur le centre des soldats encore debout,
  // et assez de recul pour les tenir tous dans le cadre — elle reste au large
  // tant que les armées sont loin l'une de l'autre, puis se rapproche au
  // contact. Elle ne dépasse jamais le recul qui montre le champ entier.
  private autoFrame(state: BattleState) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const u of state.units) {
      if (u.status !== "alive") continue;
      const [wx, wz] = toWorld(u.x, u.y);
      minX = Math.min(minX, wx);
      maxX = Math.max(maxX, wx);
      minZ = Math.min(minZ, wz);
      maxZ = Math.max(maxZ, wz);
    }
    if (!Number.isFinite(minX)) return;
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const wide = (maxX - minX) / 2 + 6;
    const deep = (maxZ - minZ) / 2 + 6;
    const wanted = Math.min(this.frameDistance, Math.max(26, wide / Math.tan(hfov / 2), (deep * 1.6) / Math.tan(vfov / 2)));
    // Au large, on garde la visée d'origine (jaquettes comprises) ; au contact,
    // on glisse vers la mêlée.
    const closeness = 1 - (wanted - 26) / Math.max(1, this.frameDistance - 26);
    const cx = ((minX + maxX) / 2) * Math.min(1, 0.35 + closeness);
    const cz = -3 + ((minZ + maxZ) / 2 + 3) * closeness;
    const target = this.controls.target;
    const k = 0.035;
    const dx = (cx - target.x) * k;
    const dz = (cz - target.z) * k;
    target.x += dx;
    target.z += dz;
    this.camera.position.x += dx;
    this.camera.position.z += dz;
    const offset = this.camera.position.clone().sub(target);
    const current = offset.length();
    offset.setLength(current + (wanted - current) * k);
    this.camera.position.copy(target).add(offset);
  }

  /** L'arrêt de la rotation automatique quand le combat commence : on regarde la mêlée. */
  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on;
  }

  dispose() {
    this.controls.dispose();
    for (const mesh of this.meshes) mesh.dispose();
    for (const label of this.labels) (label.sprite.material as THREE.SpriteMaterial).dispose();
    for (const d of this.disposables) d.dispose();
    this.setCovers({ left: null, right: null });
    this.reflector.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
