// src/scenes/components/tableenvironment-ts
import { Scene, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Color4,
    UniversalCamera, Mesh, PointLight, MultiMaterial, Vector4, SubMesh } from "@babylonjs/core";
import { CardVisualizer } from "./CardVisualizer";

export class TableEnvironment {
    private scene: Scene;
    private table: Mesh;
    private deckTopCardMesh: Mesh | null = null;
    private deckBaseMesh: Mesh | null = null;
    private deckPosition: Vector3 = new Vector3(3.5, 0, 0);

    constructor(scene: Scene, cardVisualizer: CardVisualizer) {
        this.scene = scene;
        this.scene.clearColor = new Color4(0.05, 0.2, 0.05, 1);
        this.setupCamera();
        this.setupLighting();
        this.table = this.createTable();
        this.createDeckVisual(cardVisualizer);
    }

    private setupCamera(): void {
        const camera = new UniversalCamera("camera", new Vector3(0, 15, 0), this.scene);
        camera.setTarget(new Vector3(0, 0, 0));
        camera.fov = 0.4;
    }

    private setupLighting(): void {
        const ambientLight = new HemisphericLight("ambientLight", new Vector3(0, 1, 0), this.scene);
        ambientLight.intensity = 0.9;
        ambientLight.diffuse = new Color3(1, 1, 1);
        ambientLight.specular = new Color3(0.1, 0.1, 0.1);
        ambientLight.groundColor = new Color3(0.4, 0.4, 0.4);

        const fillLight = new PointLight("fillLight", new Vector3(0, 10, 0), this.scene);
        fillLight.intensity = 0.15;
        fillLight.diffuse = new Color3(0.9, 0.9, 1.0);
        fillLight.specular = new Color3(0.05, 0.05, 0.05);
        fillLight.range = 25;
    }

    private createTable(): Mesh {
        const table = MeshBuilder.CreateBox("table", { width: 10, height: 0.5, depth: 8 }, this.scene);
        const tableMaterial = new StandardMaterial("tableMaterial", this.scene);
        tableMaterial.diffuseColor = new Color3(0.15, 0.35, 0.15);
        table.material = tableMaterial;
        table.position.y = -0.25;

        const createAreaIndicator = (name: string, zPos: number) => {
            const area = MeshBuilder.CreateDisc(name, { radius: 2.5, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
            const mat = new StandardMaterial(name + "Mat", this.scene);
            mat.diffuseColor = new Color3(0.05, 0.25, 0.05);
            mat.alpha = 0.5;
            area.material = mat;
            area.position = new Vector3(0, table.position.y + 0.25 + 0.01, zPos);
            area.rotation.x = Math.PI / 2;
            return area;
        };

        createAreaIndicator("dealerArea", -2.5);
        createAreaIndicator("playerArea", 2.5);

        return table;
    }

    /** Creates the static visual representation of the deck using a box mesh. */
    private createDeckVisual(cardVisualizer: CardVisualizer): void {
        const backMaterial = cardVisualizer.getCardBackMaterial();
        const sideMaterial = cardVisualizer.getCardSideMaterial();

        const deckY = (CardVisualizer as any).DECK_Y_POS ?? 0.01;
        const cardWidth = (CardVisualizer as any).CARD_WIDTH ?? 1.0;
        const cardHeight = (CardVisualizer as any).CARD_HEIGHT ?? 1.4;
        const cardDepth = (CardVisualizer as any).CARD_DEPTH ?? 0.02;

        // Define UV mapping: Back on +Z, Sides elsewhere
        const faceUV: Vector4[] = [
            new Vector4(0, 0, 1, 1), // Face 0 (+Z) -> Back Texture UV
            new Vector4(0, 0, 0, 0), // Face 1 (-Z) -> Side UV (tiny corner)
            new Vector4(0, 0, 0, 0), // Face 2 (+Y) -> Side UV
            new Vector4(0, 0, 0, 0), // Face 3 (-Y) -> Side UV
            new Vector4(0, 0, 0, 0), // Face 4 (+X) -> Side UV
            new Vector4(0, 0, 0, 0)  // Face 5 (-X) -> Side UV
        ];

        this.deckTopCardMesh = MeshBuilder.CreateBox("deckTopCard", {
            width: cardWidth, height: cardHeight, depth: cardDepth, faceUV: faceUV
        }, this.scene);

        this.deckTopCardMesh.position = this.deckPosition.clone();
        this.deckTopCardMesh.position.y = deckY + cardDepth / 2 + 0.001;
        this.deckTopCardMesh.rotation = new Vector3(Math.PI / 2, Math.PI, 0); // Flat, Face Down

        // Apply MultiMaterial
        const multiMat = new MultiMaterial("deckMultiMat", this.scene);
        multiMat.subMaterials.push(backMaterial); // Index 0: Back
        multiMat.subMaterials.push(sideMaterial); // Index 1: Side
        this.deckTopCardMesh.material = multiMat;

        // Assign materials to submeshes correctly
        this.deckTopCardMesh.subMeshes = [];
        const verticesCount = this.deckTopCardMesh.getTotalVertices();
        // Box Face Indices: 0:+Z, 1:-Z, 2:+Y, 3:-Y, 4:+X, 5:-X
        // Material Indices: 0:Back, 1:Side
        new SubMesh(0, 0, verticesCount, 0, 6, this.deckTopCardMesh);  // Box Face 0 (+Z) uses Material 0 (Back)
        new SubMesh(1, 0, verticesCount, 6, 6, this.deckTopCardMesh);  // Box Face 1 (-Z) uses Material 1 (Side)
        new SubMesh(1, 0, verticesCount, 12, 6, this.deckTopCardMesh); // Box Face 2 (+Y) uses Material 1 (Side)
        new SubMesh(1, 0, verticesCount, 18, 6, this.deckTopCardMesh); // Box Face 3 (-Y) uses Material 1 (Side)
        new SubMesh(1, 0, verticesCount, 24, 6, this.deckTopCardMesh); // Box Face 4 (+X) uses Material 1 (Side)
        new SubMesh(1, 0, verticesCount, 30, 6, this.deckTopCardMesh); // Box Face 5 (-X) uses Material 1 (Side)


        // --- Deck Base ---
        const baseHeight = 0.2;
        this.deckBaseMesh = MeshBuilder.CreateBox("deckBase", {
            width: cardWidth, height: baseHeight, depth: cardHeight
        }, this.scene);
        this.deckBaseMesh.position = this.deckPosition.clone();
        this.deckBaseMesh.position.y = deckY - baseHeight / 2 + 0.0005;

        const baseMaterial = new StandardMaterial("deckBaseMaterial", this.scene);
        baseMaterial.diffuseColor = new Color3(0.2, 0.2, 0.2);
        this.deckBaseMesh.material = baseMaterial;
    }

    public getScene(): Scene { return this.scene; }
    public getDeckPosition(): Vector3 { return this.deckPosition; }

    public dispose(): void {
        console.log("Disposing TableEnvironment elements");
        this.table?.dispose();
        this.deckTopCardMesh?.dispose();
        this.deckBaseMesh?.dispose();
        this.scene.getMeshByName("dealerArea")?.dispose();
        this.scene.getMeshByName("playerArea")?.dispose();
        this.scene.getMaterialByName("tableMaterial")?.dispose();
        this.scene.getMaterialByName("dealerAreaMat")?.dispose();
        this.scene.getMaterialByName("playerAreaMat")?.dispose();
        this.scene.getMaterialByName("deckBaseMaterial")?.dispose();
        this.scene.getMaterialByName("deckMultiMat")?.dispose();
    }
}
