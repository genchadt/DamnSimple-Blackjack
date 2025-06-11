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

    /**
     * Constructs a new TableEnvironment.
     * Initializes the scene, sets up the camera and lighting, and creates the table mesh.
     * Optionally creates a visual box representing the card dispenser if a CardVisualizer is provided.
     *
     * @param scene - The Babylon.js scene where the table environment will be rendered.
     * @param cardVisualizer - The CardVisualizer used to create the deck visual box.
     */
    constructor(scene: Scene, cardVisualizer: CardVisualizer) { // Expect CardVisualizer
        this.scene = scene;
        console.log("[TableEnv] Constructor called.");
        this.scene.clearColor = new Color4(0.05, 0.2, 0.05, 1);

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

    /**
     * Sets up the camera for the scene.
     * Positions the camera above the table and sets its target to the center of the table.
     */
    private setupCamera(): void {
        const camera = new UniversalCamera("camera", new Vector3(0, 15, 0), this.scene);
        camera.setTarget(new Vector3(0, 0, 0));
        camera.fov = 0.4;
        console.log("[TableEnv] Camera setup.");
    }

    /**
     * Sets up the lighting for the scene.
     * Creates an ambient light and a fill light to illuminate the table and cards.
     * The ambient light is a hemispheric light pointing down from above the table.
     * The fill light is a point light positioned above the table and pointing down.
     * The fill light has a smaller range than the ambient light, so it provides a bit more focus.
     */
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

    /**
     * Creates a mesh for the table.
     * The mesh is a box with width, height, and depth of 10, 0.5, and 8 respectively.
     * The mesh is given a material with a diffuse color that matches the table color.
     * The table is positioned so that its top surface is at y=0.
     * @returns The mesh for the table.
     */
    private createTable(): Mesh {
        const table = MeshBuilder.CreateBox("table", { width: 10, height: 0.5, depth: 8 }, this.scene);
        const tableMaterial = new StandardMaterial("tableMaterial", this.scene);
        tableMaterial.diffuseColor = new Color3(0.15, 0.35, 0.15);
        table.material = tableMaterial;
        table.position.y = -0.25; // Center of table is at -0.25, so top surface is at Y=0

        console.log("[TableEnv] Table created.");
        return table;
    }

    /**
     * Creates a visual representation of the card dispenser box in the scene.
     * Uses the CardVisualizer to determine the dimensions and materials for the box.
     * The dispenser is positioned at the deck position specified in the class.
     * MultiMaterial is used to apply different materials to the box surfaces.
     *
     * @param cardVisualizer - The CardVisualizer instance used to retrieve card dimensions and materials.
     */
    private createDeckVisualBox(cardVisualizer: CardVisualizer): void {
        console.log("%c[TableEnv] Creating Deck Visual Box (Dispenser)...", "color: blue; font-weight: bold;");
        try {
            console.log("[TableEnv]   Getting dimensions from CardVisualizer...");
            const cardWidth = cardVisualizer.getCardWidth();
            const cardHeight = cardVisualizer.getCardHeight();
            const dispenserHeight = 0.25;
            console.log(`[TableEnv]     -> CardWidth: ${cardWidth}, CardDepth(fromCardHeight): ${cardHeight}, DispenserHeight: ${dispenserHeight}`);

            console.log("[TableEnv]   Calling MeshBuilder.CreateBox...");
            this.deckVisualMesh = MeshBuilder.CreateBox("deckDispenserBox", {
                width: cardWidth,
                height: dispenserHeight,
                depth: cardHeight
            }, this.scene);

            if (!this.deckVisualMesh) {
                console.error("[TableEnv]   ERROR: MeshBuilder.CreateBox returned null/undefined!");
                return;
            }
            console.log(`%c[TableEnv]   Deck dispenser box mesh CREATED successfully. Name: ${this.deckVisualMesh.name}`, "color: green;");

            console.log("[TableEnv]   Creating dispenser multi-material...");
            const dispenserMultiMat = new MultiMaterial("deckDispenserMultiMat", this.scene);

            const cardBackMat = cardVisualizer.getCardBackMaterial();
            const cardSideMat = cardVisualizer.getCardSideMaterial();
            const bottomMat = new StandardMaterial("deckDispenserBottomMat", this.scene);
            bottomMat.diffuseColor = new Color3(0.05, 0.05, 0.05);

            const MATIDX_DISP_TOP_BACK = 0;
            const MATIDX_DISP_SIDE = 1;
            const MATIDX_DISP_BOTTOM = 2;

            dispenserMultiMat.subMaterials.push(cardBackMat);
            dispenserMultiMat.subMaterials.push(cardSideMat);
            dispenserMultiMat.subMaterials.push(bottomMat);

            this.deckVisualMesh.material = dispenserMultiMat;

            this.deckVisualMesh.subMeshes = [];
            const verticesCount = this.deckVisualMesh.getTotalVertices();
            new SubMesh(MATIDX_DISP_SIDE, 0, verticesCount, 0, 6, this.deckVisualMesh);
            new SubMesh(MATIDX_DISP_SIDE, 0, verticesCount, 6, 6, this.deckVisualMesh);
            new SubMesh(MATIDX_DISP_SIDE, 0, verticesCount, 12, 6, this.deckVisualMesh);
            new SubMesh(MATIDX_DISP_SIDE, 0, verticesCount, 18, 6, this.deckVisualMesh);
            new SubMesh(MATIDX_DISP_TOP_BACK, 0, verticesCount, 24, 6, this.deckVisualMesh);
            new SubMesh(MATIDX_DISP_BOTTOM, 0, verticesCount, 30, 6, this.deckVisualMesh);

            console.log("[TableEnv]   Assigned MultiMaterial with card back/side textures.");


            const targetCenterY = cardVisualizer.getAnimationOriginY();
            console.log(`[TableEnv]     -> Target Center Y for Dispenser: ${targetCenterY}`);

            this.deckVisualMesh.position = new Vector3(
                this.deckPosition.x,
                targetCenterY,
                this.deckPosition.z
            );
            console.log(`[TableEnv]   Final Deck Dispenser Position: ${this.deckVisualMesh.position.toString()}`);

            this.deckVisualMesh.isPickable = false;
            console.log("%c[TableEnv] Deck Visual Box setup COMPLETE.", "color: blue; font-weight: bold;");

        } catch (error) {
            console.error("%c[TableEnv] CRITICAL ERROR during createDeckVisualBox:", "color: red; font-weight: bold;", error);
            this.deckVisualMesh?.dispose();
            this.scene.getMaterialByName("deckDispenserMultiMat")?.dispose();
            this.scene.getMaterialByName("deckDispenserBottomMat")?.dispose();
            this.deckVisualMesh = null;
        }
    }

    /**
     * Retrieves the current Babylon.js scene instance.
     *
     * @returns {Scene} The scene associated with the table environment.
     */
    public getScene(): Scene { return this.scene; }
    public getDeckPosition(): Vector3 {
        return new Vector3(Constants.DECK_POSITION_X, 0, Constants.DECK_POSITION_Z);
    }

    /**
     * Disposes all elements of the TableEnvironment instance.
     *
     * This disposes:
     *  - The Table mesh
     *  - The Deck Visual mesh
     *  - The tableMaterial
     *  - The deckDispenserMultiMat
     *  - The deckDispenserBottomMat
     *
     * Called by GameScene when it needs to dispose its resources.
     */
    public dispose(): void {
        console.log("[TableEnv] Disposing TableEnvironment elements");
        this.table?.dispose();
        this.deckVisualMesh?.dispose();
        this.scene.getMaterialByName("tableMaterial")?.dispose();
        this.scene.getMaterialByName("deckDispenserMultiMat")?.dispose();
        this.scene.getMaterialByName("deckDispenserBottomMat")?.dispose();
        console.log("[TableEnv] Disposed.");
    }
}