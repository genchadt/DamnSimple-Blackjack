// scenes/GameScene.ts
import { Scene, Engine, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, ArcRotateCamera, Mesh, TransformNode, Quaternion, Space, Animation } from "@babylonjs/core";
import { Card, Suit, Rank } from "../game/Card";
import { BlackjackGame } from "../game/BlackjackGame";
import { GameUI } from "../ui/GameUI";

export class GameScene {
    private scene: Scene;
    private blackjackGame: BlackjackGame;
    private gameUI: GameUI;
    private table: Mesh;
    private cardMeshes: Map<Card, Mesh> = new Map();
    private playerCardContainer: TransformNode;
    private dealerCardContainer: TransformNode;

    constructor(engine: Engine, canvas: HTMLCanvasElement) {
        this.scene = new Scene(engine);
        this.blackjackGame = new BlackjackGame();
        
        // Set background color to a dark green (casino table feel)
        this.scene.clearColor = new Color3(0.05, 0.2, 0.05);
        
        // Create camera
        const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 3, 12, Vector3.Zero(), this.scene);
        camera.attachControl(canvas, true);
        camera.upperBetaLimit = Math.PI / 2.2;
        camera.lowerRadiusLimit = 8;
        camera.upperRadiusLimit = 20;
        
        // Create light
        const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
        light.intensity = 0.7;
        
        // Create table and card containers
        this.createTable();
        this.playerCardContainer = new TransformNode("playerCards", this.scene);
        this.playerCardContainer.position = new Vector3(0, 0.2, 1.5);
        
        this.dealerCardContainer = new TransformNode("dealerCards", this.scene);
        this.dealerCardContainer.position = new Vector3(0, 0.2, -1.5);
        
        // Create UI
        this.gameUI = new GameUI(this.scene, this.blackjackGame);
        
        // Start a new game
        this.blackjackGame.startNewGame();
        this.renderCards();
        
        // Add click handler for flipping cards (for testing)
        this.scene.onPointerDown = () => {
            this.update();
        };
    }

    private createTable(): void {
        this.table = MeshBuilder.CreateBox("table", { width: 8, height: 0.2, depth: 5 }, this.scene);
        const tableMaterial = new StandardMaterial("tableMaterial", this.scene);
        tableMaterial.diffuseColor = new Color3(0.1, 0.3, 0.1);
        this.table.material = tableMaterial;
        
        // Add felt texture to table
        const tableTop = MeshBuilder.CreateGround("tableTop", { width: 7.5, height: 4.5 }, this.scene);
        const feltMaterial = new StandardMaterial("feltMaterial", this.scene);
        feltMaterial.diffuseColor = new Color3(0.0, 0.25, 0.0);
        tableTop.material = feltMaterial;
        tableTop.position.y = 0.11;
    }

    private createCardMesh(card: Card): Mesh {
        // Create a simple card mesh (rectangle)
        const cardMesh = MeshBuilder.CreateBox(`card_${card.getSuit()}_${card.getRank()}`, 
            { width: 0.7, height: 0.01, depth: 1 }, this.scene);
        
        // Create materials for front and back
        const frontMaterial = new StandardMaterial(`front_${card.getSuit()}_${card.getRank()}`, this.scene);
        frontMaterial.diffuseColor = new Color3(1, 1, 1);
        
        const backMaterial = new StandardMaterial(`back_${card.getSuit()}_${card.getRank()}`, this.scene);
        backMaterial.diffuseColor = new Color3(0.1, 0.1, 0.7);
        
        // Create multi-material
        const multiMat = new MultiMaterial("multiMat", this.scene);
        multiMat.subMaterials.push(frontMaterial);
        multiMat.subMaterials.push(backMaterial);
        
        cardMesh.material = card.isFaceUp() ? frontMaterial : backMaterial;
        
        return cardMesh;
    }

    private renderCards(): void {
        // Clear existing card meshes
        this.cardMeshes.forEach((mesh) => {
            mesh.dispose();
        });
        this.cardMeshes.clear();
        
        // Render player cards
        const playerHand = this.blackjackGame.getPlayerHand();
        playerHand.forEach((card, index) => {
            const cardMesh = this.createCardMesh(card);
            cardMesh.position = new Vector3(index * 0.8 - (playerHand.length - 1) * 0.4, 0, 0);
            cardMesh.parent = this.playerCardContainer;
            this.cardMeshes.set(card, cardMesh);
        });
        
        // Render dealer cards
        const dealerHand = this.blackjackGame.getDealerHand();
        dealerHand.forEach((card, index) => {
            const cardMesh = this.createCardMesh(card);
            cardMesh.position = new Vector3(index * 0.8 - (dealerHand.length - 1) * 0.4, 0, 0);
            cardMesh.parent = this.dealerCardContainer;
            this.cardMeshes.set(card, cardMesh);
        });
    }

    private flipCard(card: Card, mesh: Mesh): void {
        // Create animation
        const flipAnimation = new Animation(
            "flipAnimation",
            "rotation.x",
            30,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        
        // Keyframes
        const keyFrames = [];
        keyFrames.push({
            frame: 0,
            value: 0
        });
        keyFrames.push({
            frame: 15,
            value: Math.PI / 2
        });
        keyFrames.push({
            frame: 30,
            value: Math.PI
        });
        
        flipAnimation.setKeys(keyFrames);
        
        // Run animation
        this.scene.beginDirectAnimation(mesh, [flipAnimation], 0, 30, false, 1, () => {
            // Update material after animation completes
            const frontMaterial = new StandardMaterial(`front_${card.getSuit()}_${card.getRank()}`, this.scene);
            frontMaterial.diffuseColor = new Color3(1, 1, 1);
            
            const backMaterial = new StandardMaterial(`back_${card.getSuit()}_${card.getRank()}`, this.scene);
            backMaterial.diffuseColor = new Color3(0.1, 0.1, 0.7);
            
            mesh.material = card.isFaceUp() ? frontMaterial : backMaterial;
        });
    }

    public update(): void {
        this.renderCards();
        this.gameUI.update();
    }

    public getScene(): Scene {
        return this.scene;
    }

    public getBlackjackGame(): BlackjackGame {
        return this.blackjackGame;
    }
}
