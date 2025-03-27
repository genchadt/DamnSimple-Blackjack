// scenes/components/TableEnvironment.ts
import { Scene, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Color4,
    UniversalCamera, Mesh, PointLight } from "@babylonjs/core";
// *** ADD CardVisualizer import ***
import { CardVisualizer } from "./CardVisualizer"; // Adjust path if needed

export class TableEnvironment {
    private scene: Scene;
    private table: Mesh;
    // *** REMOVED old deckMesh ***
    // private deckMesh: Mesh;
    private deckTopCardMesh: Mesh | null = null; // Mesh for the top card visual
    private deckBaseMesh: Mesh | null = null; // Optional base for thickness
    private deckPosition: Vector3 = new Vector3(3.5, 0, 0); // Keep X/Z, Y will be set by CardVisualizer constants

    // *** ADD CardVisualizer parameter ***
    constructor(scene: Scene, cardVisualizer: CardVisualizer) {
        this.scene = scene;

        // Set background color
        this.scene.clearColor = new Color4(0.05, 0.2, 0.05, 1);

        // Setup camera and lighting
        this.setupCamera();
        this.setupLighting();

        // Create table and deck
        this.table = this.createTable();
        // *** Pass cardVisualizer to createDeckVisual ***
        this.createDeckVisual(cardVisualizer);
    }

    /**
     * Sets up the camera for the scene.
     * Creates a top-down UniversalCamera with a narrow FOV to give a more orthographic-like appearance.
     */
    private setupCamera(): void {
        // Top-down camera - This setup is correct for top-down view
        const camera = new UniversalCamera("camera", new Vector3(0, 15, 0), this.scene);
        camera.setTarget(new Vector3(0, 0, 0));
        camera.fov = 0.4; // Narrow FOV for more orthographic-like appearance
        // Disable rotation controls if needed
        // camera.inputs.remove(camera.inputs.attached.mouse);
    }

    /**
     * Sets up the lighting for the scene.
     * The scene is given a single ambient light with a soft ground reflection, and a subtle fill light
     * to reduce the appearance of harsh shadows.
     */
    private setupLighting(): void {
        // Main ambient light
        const ambientLight = new HemisphericLight("ambientLight", new Vector3(0, 1, 0), this.scene);
        ambientLight.intensity = 0.7;
        ambientLight.diffuse = new Color3(1, 1, 1);
        ambientLight.specular = new Color3(0.1, 0.1, 0.1);
        ambientLight.groundColor = new Color3(0.5, 0.5, 0.5);

        // Subtle fill light
        const fillLight = new PointLight("fillLight", new Vector3(0, 8, 0), this.scene);
        fillLight.intensity = 0.3;
        fillLight.diffuse = new Color3(0.9, 0.9, 1.0);
        fillLight.specular = new Color3(0.1, 0.1, 0.1);
        fillLight.range = 20;
    }

    /**
     * Creates a table mesh for the scene with a green color material and positions it below the y-axis.
     * Also creates transparent indicators for dealer and player areas using disc meshes.
     * The dealer area is positioned in front of the table, while the player area is positioned behind.
     *
     * @returns {Mesh} The mesh representing the table.
     */
    private createTable(): Mesh {
        // Green table
        const table = MeshBuilder.CreateBox("table", { width: 10, height: 0.5, depth: 8 }, this.scene);
        const tableMaterial = new StandardMaterial("tableMaterial", this.scene);
        tableMaterial.diffuseColor = new Color3(0.1, 0.3, 0.1); // Dark green felt
        table.material = tableMaterial;
        table.position.y = -0.25; // Position table surface below y=0

        // Dealer area indicator
        const dealerArea = MeshBuilder.CreateDisc("dealerArea", { radius: 2.5, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
        const dealerAreaMat = new StandardMaterial("dealerAreaMat", this.scene);
        dealerAreaMat.diffuseColor = new Color3(0.05, 0.25, 0.05); // Slightly darker green
        dealerAreaMat.alpha = 0.5; // Semi-transparent
        dealerArea.material = dealerAreaMat;
        // Position slightly above the table surface to avoid z-fighting
        dealerArea.position = new Vector3(0, table.position.y + 0.25 + 0.01, -2.5);
        dealerArea.rotation.x = Math.PI / 2; // Rotate to lie flat

        // Player area indicator
        const playerArea = MeshBuilder.CreateDisc("playerArea", { radius: 2.5, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
        const playerAreaMat = new StandardMaterial("playerAreaMat", this.scene);
        playerAreaMat.diffuseColor = new Color3(0.05, 0.25, 0.05);
        playerAreaMat.alpha = 0.5;
        playerArea.material = playerAreaMat;
        // Position slightly above the table surface
        playerArea.position = new Vector3(0, table.position.y + 0.25 + 0.01, 2.5);
        playerArea.rotation.x = Math.PI / 2; // Rotate to lie flat

        return table;
    }

    /**
     * Creates a visual representation of the card deck using a flat plane
     * with the card back material and an optional base for thickness.
     *
     * @param cardVisualizer The CardVisualizer instance to get the back material from.
     */
    // *** MODIFIED to use CardVisualizer and create a Plane ***
    private createDeckVisual(cardVisualizer: CardVisualizer): void {
        const backMaterial = cardVisualizer.getCardBackMaterial();
        if (!backMaterial) {
            console.error("Could not get card back material to create deck visual!");
            return;
        }

        // Use constants from CardVisualizer for consistency
        const deckY = (CardVisualizer as any).DECK_Y_POS; // Access private static
        const cardWidth = (CardVisualizer as any).CARD_WIDTH;
        const cardHeight = (CardVisualizer as any).CARD_HEIGHT;

        // Create the top card visual (Plane)
        this.deckTopCardMesh = MeshBuilder.CreatePlane("deckTopCard", {
            width: cardWidth,
            height: cardHeight,
            sideOrientation: Mesh.DOUBLESIDE
        }, this.scene);

        // Position and rotate the top card plane
        this.deckTopCardMesh.position = this.deckPosition.clone(); // Uses the adjusted Y from constructor
        this.deckTopCardMesh.position.y = deckY + 0.001; // Place slightly above base if base exists
        this.deckTopCardMesh.rotation = new Vector3(Math.PI / 2, 0, Math.PI); // Flat, face down

        // Apply the card back material
        this.deckTopCardMesh.material = backMaterial;

        // Optional: Create a base box for visual thickness
        const baseHeight = 0.2;
        this.deckBaseMesh = MeshBuilder.CreateBox("deckBase", {
            width: cardWidth,
            height: baseHeight, // Visual thickness
            depth: cardHeight
        }, this.scene);
        // Position base below the top card
        this.deckBaseMesh.position = this.deckPosition.clone();
        this.deckBaseMesh.position.y = deckY - (baseHeight / 2) + 0.0005; // Center base below deckY

        const baseMaterial = new StandardMaterial("deckBaseMaterial", this.scene);
        baseMaterial.diffuseColor = new Color3(0.2, 0.2, 0.2); // Dark color for base
        this.deckBaseMesh.material = baseMaterial;
    }


    /**
     * Retrieves the Babylon.js scene instance associated with this table environment.
     *
     * @returns {Scene} The scene used in this TableEnvironment.
     */
    public getScene(): Scene {
        return this.scene;
    }

    /**
     * Retrieves the starting position for dealing cards (deck position).
     *
     * @returns {Vector3} The position of the deck.
     */
    public getDeckPosition(): Vector3 {
        // Return the base deck position (X/Z), Y will be handled by CardVisualizer
        return this.deckPosition;
    }

    // *** ADDED dispose method ***
    public dispose(): void {
        console.log("Disposing TableEnvironment elements");
        this.table?.dispose();
        this.deckTopCardMesh?.dispose();
        this.deckBaseMesh?.dispose();
        // Dispose area indicators if needed (assuming they are children or handled by scene dispose)
        // Dispose materials if they are unique to this environment
    }
}
