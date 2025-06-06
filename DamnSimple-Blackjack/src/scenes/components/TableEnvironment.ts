// src/scenes/components/tableenvironment.ts
// Restore setupCamera/setupLighting and fix Constants import path
import { Scene, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Color4,
    UniversalCamera, Mesh, PointLight, Material, MultiMaterial, SubMesh,
} from "@babylonjs/core";
import { CardVisualizer } from "./CardVisualizer";
import { Constants } from "../../Constants"; // *** CORRECTED Import Path ***

export class TableEnvironment {
    private scene: Scene;
    private table!: Mesh;
    /** The mesh representing the visual card dispenser box. */
    private deckVisualMesh: Mesh | null = null;
    /** The logical position where cards originate from (center of the dispenser). */
    private deckPosition: Vector3 = new Vector3(
        Constants.DECK_POSITION_X,
        0, // Y will be set dynamically during creation
        Constants.DECK_POSITION_Z
    );

    constructor(scene: Scene, cardVisualizer: CardVisualizer) { // Expect CardVisualizer
        this.scene = scene;
        console.log("[TableEnv] Constructor called.");
        this.scene.clearColor = new Color4(0.05, 0.2, 0.05, 1);

        // *** CALL Restored Methods ***
        this.setupCamera();
        this.setupLighting();
        this.table = this.createTable();

        if (cardVisualizer) {
            this.createDeckVisualBox(cardVisualizer);
        } else {
            console.error("[TableEnv] ERROR: CardVisualizer was not provided to constructor! Cannot create deck visual.");
        }
        console.log("[TableEnv] Constructor finished.");
    }

    // *** RESTORED setupCamera ***
    private setupCamera(): void {
        const camera = new UniversalCamera("camera", new Vector3(0, 15, 0), this.scene);
        camera.setTarget(new Vector3(0, 0, 0));
        camera.fov = 0.4;
        console.log("[TableEnv] Camera setup.");
    }

    // *** RESTORED setupLighting ***
    private setupLighting(): void {
        const ambientLight = new HemisphericLight("ambientLight", new Vector3(0, 1, 0), this.scene);
        ambientLight.intensity = 1.0;
        ambientLight.diffuse = new Color3(1, 1, 1);
        ambientLight.specular = new Color3(0.1, 0.1, 0.1);
        ambientLight.groundColor = new Color3(0.5, 0.5, 0.5);

        const fillLight = new PointLight("fillLight", new Vector3(0, 8, 0), this.scene);
        fillLight.intensity = 0.25;
        fillLight.diffuse = new Color3(0.9, 0.9, 1.0);
        fillLight.specular = new Color3(0.05, 0.05, 0.05);
        fillLight.range = 30;
        console.log("[TableEnv] Lighting setup.");
    }

    private createTable(): Mesh {
        const table = MeshBuilder.CreateBox("table", { width: 10, height: 0.5, depth: 8 }, this.scene);
        const tableMaterial = new StandardMaterial("tableMaterial", this.scene);
        tableMaterial.diffuseColor = new Color3(0.15, 0.35, 0.15);
        table.material = tableMaterial;
        table.position.y = -0.25; // Center of table is at -0.25, so top surface is at Y=0

        const createAreaIndicator = (name: string, zPos: number) => {
            const area = MeshBuilder.CreateDisc(name, { radius: 2.5, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
            const mat = new StandardMaterial(name + "Mat", this.scene);
            mat.diffuseColor = new Color3(0.05, 0.25, 0.05);
            mat.alpha = 0.5;
            mat.transparencyMode = Material.MATERIAL_ALPHABLEND;
            area.material = mat;
            // Place indicator slightly above table surface (Y=0)
            area.position = new Vector3(0, 0.01, zPos);
            area.rotation.x = Math.PI / 2;
            return area;
        };

        createAreaIndicator("dealerArea", Constants.DEALER_HAND_Z); // Place at dealer hand Z
        createAreaIndicator("playerArea", Constants.PLAYER_HAND_Z); // Place at player hand Z
        console.log("[TableEnv] Table and area indicators created.");
        return table;
    }

    /**
     * Creates a simple black box mesh to visually represent the card dispenser.
     * Card animations will originate from the center of this box's location.
     * @param cardVisualizer Used to get card dimensions for sizing the box.
     */
    private createDeckVisualBox(cardVisualizer: CardVisualizer): void {
        console.log("%c[TableEnv] Creating Deck Visual Box (Dispenser)...", "color: blue; font-weight: bold;");
        try {
            // --- Get Card Dimensions ---
            console.log("[TableEnv]   Getting dimensions from CardVisualizer...");
            const cardWidth = cardVisualizer.getCardWidth();
            const cardHeight = cardVisualizer.getCardHeight(); // This is card's visual height, used as depth for dispenser
            const dispenserHeight = 0.25; // Fixed visual height for the dispenser box itself
            console.log(`[TableEnv]     -> CardWidth: ${cardWidth}, CardDepth(fromCardHeight): ${cardHeight}, DispenserHeight: ${dispenserHeight}`);

            // --- Create the Box Mesh ---
            console.log("[TableEnv]   Calling MeshBuilder.CreateBox...");
            this.deckVisualMesh = MeshBuilder.CreateBox("deckDispenserBox", {
                width: cardWidth,       // X-axis
                height: dispenserHeight,  // Y-axis (actual height of the box)
                depth: cardHeight        // Z-axis (depth of the box, using card's visual height)
            }, this.scene);

            if (!this.deckVisualMesh) {
                console.error("[TableEnv]   ERROR: MeshBuilder.CreateBox returned null/undefined!");
                return;
            }
            console.log(`%c[TableEnv]   Deck dispenser box mesh CREATED successfully. Name: ${this.deckVisualMesh.name}`, "color: green;");

            // --- Create and Assign MultiMaterial ---
            console.log("[TableEnv]   Creating dispenser multi-material...");
            const dispenserMultiMat = new MultiMaterial("deckDispenserMultiMat", this.scene);

            const cardBackMat = cardVisualizer.getCardBackMaterial();
            const cardSideMat = cardVisualizer.getCardSideMaterial();
            const bottomMat = new StandardMaterial("deckDispenserBottomMat", this.scene);
            bottomMat.diffuseColor = new Color3(0.05, 0.05, 0.05); // Black for bottom

            // Material order for MultiMaterial:
            const MATIDX_DISP_TOP_BACK = 0; // Card Back for Top Face (+Y)
            const MATIDX_DISP_SIDE = 1;     // Card Side for Side Faces
            const MATIDX_DISP_BOTTOM = 2;   // Black for Bottom Face (-Y)

            dispenserMultiMat.subMaterials.push(cardBackMat);    // [0]
            dispenserMultiMat.subMaterials.push(cardSideMat);    // [1]
            dispenserMultiMat.subMaterials.push(bottomMat);      // [2]

            this.deckVisualMesh.material = dispenserMultiMat;

            // Assign SubMeshes. Box faces order: +Z, -Z, +X, -X, +Y, -Y
            this.deckVisualMesh.subMeshes = [];
            const verticesCount = this.deckVisualMesh.getTotalVertices();
            // Face 0 (+Z side of dispenser)
            new SubMesh(MATIDX_DISP_SIDE, 0, verticesCount, 0, 6, this.deckVisualMesh);
            // Face 1 (-Z side of dispenser)
            new SubMesh(MATIDX_DISP_SIDE, 0, verticesCount, 6, 6, this.deckVisualMesh);
            // Face 2 (+X side of dispenser)
            new SubMesh(MATIDX_DISP_SIDE, 0, verticesCount, 12, 6, this.deckVisualMesh);
            // Face 3 (-X side of dispenser)
            new SubMesh(MATIDX_DISP_SIDE, 0, verticesCount, 18, 6, this.deckVisualMesh);
            // Face 4 (+Y top of dispenser)
            new SubMesh(MATIDX_DISP_TOP_BACK, 0, verticesCount, 24, 6, this.deckVisualMesh);
            // Face 5 (-Y bottom of dispenser)
            new SubMesh(MATIDX_DISP_BOTTOM, 0, verticesCount, 30, 6, this.deckVisualMesh);

            console.log("[TableEnv]   Assigned MultiMaterial with card back/side textures.");


            // --- Position the Box ---
            // Calculate the Y position for the CENTER of the dispenser box.
            // It should sit slightly above the table surface (Y=0).
            // We use the animation origin Y from CardVisualizer as the target center.
            const targetCenterY = cardVisualizer.getAnimationOriginY();
            console.log(`[TableEnv]     -> Target Center Y for Dispenser: ${targetCenterY}`);

            // Use the Constants for X and Z from this.deckPosition
            this.deckVisualMesh.position = new Vector3(
                this.deckPosition.x, // From Constants via constructor
                targetCenterY,      // Calculated center Y
                this.deckPosition.z  // From Constants via constructor
            );
            console.log(`[TableEnv]   Final Deck Dispenser Position: ${this.deckVisualMesh.position.toString()}`);

            // --- Final Settings ---
            this.deckVisualMesh.isPickable = false;
            console.log("[TableEnv]   Attempting to freeze world matrix...");
            // Do not freeze world matrix if individual sub-materials might need updates (e.g. dynamic textures)
            // this.deckVisualMesh.freezeWorldMatrix(); 
            // console.log("[TableEnv]   Froze world matrix for deck dispenser mesh.");

            console.log("%c[TableEnv] Deck Visual Box setup COMPLETE.", "color: blue; font-weight: bold;");

        } catch (error) {
             console.error("%c[TableEnv] CRITICAL ERROR during createDeckVisualBox:", "color: red; font-weight: bold;", error);
             this.deckVisualMesh?.dispose();
             this.scene.getMaterialByName("deckDispenserMultiMat")?.dispose(); // Dispose MultiMaterial
             this.scene.getMaterialByName("deckDispenserBottomMat")?.dispose(); // Dispose specific sub-material
             // CardBack and CardSide materials are managed by CardVisualizer, no need to dispose here.
             this.deckVisualMesh = null;
        }
    }

    public getScene(): Scene { return this.scene; }
    /** Returns the logical position (XZ) where card animations should originate. */
    public getDeckPosition(): Vector3 {
        // Return a clone using the constants
        return new Vector3(Constants.DECK_POSITION_X, 0, Constants.DECK_POSITION_Z);
    }

    public dispose(): void {
        console.log("[TableEnv] Disposing TableEnvironment elements");
        this.table?.dispose();
        this.deckVisualMesh?.dispose();
        this.scene.getMeshByName("dealerArea")?.dispose();
        this.scene.getMeshByName("playerArea")?.dispose();
        this.scene.getMaterialByName("tableMaterial")?.dispose();
        this.scene.getMaterialByName("dealerAreaMat")?.dispose();
        this.scene.getMaterialByName("playerAreaMat")?.dispose();
        // Dispose materials created by TableEnvironment
        this.scene.getMaterialByName("deckDispenserMultiMat")?.dispose();
        this.scene.getMaterialByName("deckDispenserBottomMat")?.dispose();
        console.log("[TableEnv] Disposed.");
    }
}