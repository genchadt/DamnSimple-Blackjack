// src/scenes/components/tableenvironment-ts
import { Scene, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Color4,
    UniversalCamera, Mesh, PointLight } from "@babylonjs/core";
import { CardVisualizer } from "./CardVisualizer"; // CardVisualizer needs to be imported

export class TableEnvironment {
    private scene: Scene;
    private table: Mesh;
    private deckTopCardMesh: Mesh | null = null;
    private deckBaseMesh: Mesh | null = null;
    // Position for the deck visual on the table
    private deckPosition: Vector3 = new Vector3(3.5, 0, 0); // X=3.5, Z=0 (Y set later)

    constructor(scene: Scene, cardVisualizer: CardVisualizer) {
        this.scene = scene;
        // Set background color (dark green)
        this.scene.clearColor = new Color4(0.05, 0.2, 0.05, 1);
        this.setupCamera();
        this.setupLighting();
        this.table = this.createTable();
        // Create the static deck visual using the card back material from CardVisualizer
        this.createDeckVisual(cardVisualizer);
    }

    /** Configures the main camera for the scene. */
    private setupCamera(): void {
        // Use UniversalCamera for potential WASD/Arrow key movement if needed later
        const camera = new UniversalCamera("camera", new Vector3(0, 15, 0), this.scene); // Positioned above the center
        camera.setTarget(new Vector3(0, 0, 0)); // Looking down at the center
        camera.fov = 0.4; // Field of view, adjust for desired zoom level
        // camera.attachControl(canvas, true); // Attach controls if needed
    }

    /** Sets up the lighting for the scene using Hemispheric and Point lights. */
    private setupLighting(): void {
        // Main ambient light (provides base illumination)
        const ambientLight = new HemisphericLight("ambientLight", new Vector3(0, 1, 0), this.scene); // Light from above
        ambientLight.intensity = 0.9; // Fairly bright ambient light
        ambientLight.diffuse = new Color3(1, 1, 1); // White light
        ambientLight.specular = new Color3(0.1, 0.1, 0.1); // Low specular highlights
        ambientLight.groundColor = new Color3(0.4, 0.4, 0.4); // Ambient light color from below

        // Subtle point light (adds some definition, can cast shadows if needed later)
        const fillLight = new PointLight("fillLight", new Vector3(0, 10, 0), this.scene); // Positioned high
        fillLight.intensity = 0.15; // Low intensity, just for fill
        fillLight.diffuse = new Color3(0.9, 0.9, 1.0); // Slightly cool light
        fillLight.specular = new Color3(0.05, 0.05, 0.05); // Very low specular
        fillLight.range = 25; // How far the light reaches
    }

    /** Creates the main table mesh and betting area indicators. */
    private createTable(): Mesh {
        // Create the table surface (a flat box)
        const table = MeshBuilder.CreateBox("table", { width: 10, height: 0.5, depth: 8 }, this.scene);
        const tableMaterial = new StandardMaterial("tableMaterial", this.scene);
        tableMaterial.diffuseColor = new Color3(0.15, 0.35, 0.15); // Green felt color
        table.material = tableMaterial;
        table.position.y = -0.25; // Position it slightly below origin

        // Visual indicator for the dealer area
        const dealerArea = MeshBuilder.CreateDisc("dealerArea", { radius: 2.5, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
        const dealerAreaMat = new StandardMaterial("dealerAreaMat", this.scene);
        dealerAreaMat.diffuseColor = new Color3(0.05, 0.25, 0.05); // Darker green
        dealerAreaMat.alpha = 0.5; // Semi-transparent
        dealerArea.material = dealerAreaMat;
        // Position in front of dealer, slightly above table surface
        dealerArea.position = new Vector3(0, table.position.y + 0.25 + 0.01, -2.5);
        dealerArea.rotation.x = Math.PI / 2; // Rotate to lay flat

        // Visual indicator for the player area
        const playerArea = MeshBuilder.CreateDisc("playerArea", { radius: 2.5, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
        const playerAreaMat = new StandardMaterial("playerAreaMat", this.scene);
        playerAreaMat.diffuseColor = new Color3(0.05, 0.25, 0.05); // Darker green
        playerAreaMat.alpha = 0.5; // Semi-transparent
        playerArea.material = playerAreaMat;
        // Position in front of player, slightly above table surface
        playerArea.position = new Vector3(0, table.position.y + 0.25 + 0.01, 2.5);
        playerArea.rotation.x = Math.PI / 2; // Rotate to lay flat

        return table;
    }

    /** Creates the static visual representation of the deck (top card + base). */
    private createDeckVisual(cardVisualizer: CardVisualizer): void {
        const backMaterial = cardVisualizer.getCardBackMaterial();
        if (!backMaterial) {
            console.error("Could not get card back material to create deck visual!");
            return;
        }

        // Use constants from CardVisualizer for dimensions and Y position
        // Accessing static members directly (assuming they are public or using a getter)
        // If they are private, pass them in or use getters. Using direct access for brevity.
        const deckY = (CardVisualizer as any).DECK_Y_POS ?? 0.01;
        const cardWidth = (CardVisualizer as any).CARD_WIDTH ?? 1.0;
        const cardHeight = (CardVisualizer as any).CARD_HEIGHT ?? 1.4;

        // Create the top card visual (a plane with back material)
        this.deckTopCardMesh = MeshBuilder.CreatePlane("deckTopCard", {
            width: cardWidth,
            height: cardHeight,
            sideOrientation: Mesh.DOUBLESIDE // Render both sides
        }, this.scene);

        // Position the top card at the deck location
        this.deckTopCardMesh.position = this.deckPosition.clone();
        this.deckTopCardMesh.position.y = deckY + 0.001; // Slightly above base Y
        // Rotate to lay flat, matching the initial orientation of dealt cards
        this.deckTopCardMesh.rotation = new Vector3(Math.PI / 2, 0, 0);
        this.deckTopCardMesh.material = backMaterial;

        // Create a simple box base for the deck
        const baseHeight = 0.2;
        this.deckBaseMesh = MeshBuilder.CreateBox("deckBase", {
            width: cardWidth,
            height: baseHeight,
            depth: cardHeight // Depth matches card height when flat
        }, this.scene);
        // Position the base slightly below the top card
        this.deckBaseMesh.position = this.deckPosition.clone();
        this.deckBaseMesh.position.y = deckY - (baseHeight / 2) + 0.0005;

        const baseMaterial = new StandardMaterial("deckBaseMaterial", this.scene);
        baseMaterial.diffuseColor = new Color3(0.2, 0.2, 0.2); // Dark gray base
        this.deckBaseMesh.material = baseMaterial;
    }

    public getScene(): Scene { return this.scene; }
    /** Returns the position used for the static deck visual and deal animations. */
    public getDeckPosition(): Vector3 { return this.deckPosition; }

    /** Disposes of the meshes and materials created by this class. */
    public dispose(): void {
        console.log("Disposing TableEnvironment elements");
        this.table?.dispose();
        this.deckTopCardMesh?.dispose();
        this.deckBaseMesh?.dispose();
        // Dispose area indicators explicitly if they weren't parented or handled elsewhere
        this.scene.getMeshByName("dealerArea")?.dispose();
        this.scene.getMeshByName("playerArea")?.dispose();
        // Dispose materials to free up resources
        this.scene.getMaterialByName("tableMaterial")?.dispose();
        this.scene.getMaterialByName("dealerAreaMat")?.dispose();
        this.scene.getMaterialByName("playerAreaMat")?.dispose();
        this.scene.getMaterialByName("deckBaseMaterial")?.dispose();
        // Note: Card materials are managed/cached by CardVisualizer
    }
}
