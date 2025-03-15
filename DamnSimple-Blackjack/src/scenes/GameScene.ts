// Updated GameScene.ts
import { Scene, Engine, Vector3, HemisphericLight, MeshBuilder, StandardMaterial, Color3, Color4, UniversalCamera, Mesh, TransformNode, Animation, Texture } from "@babylonjs/core";
import { Card, Suit, Rank } from "../game/Card";
import { BlackjackGame, GameState } from "../game/BlackjackGame";
import { GameUI } from "../ui/GameUI";

export class GameScene {
    private scene: Scene;
    private blackjackGame: BlackjackGame;
    private gameUI: GameUI;
    private table!: Mesh;
    private deckMesh!: Mesh;
    private cardMeshes: Map<Card, Mesh> = new Map();
    private playerCardContainer: TransformNode;
    private dealerCardContainer: TransformNode;

    constructor(engine: Engine, canvas: HTMLCanvasElement, onOpenSettings: () => void) {
        console.log("GameScene constructor called");
        this.scene = new Scene(engine);
        this.blackjackGame = new BlackjackGame();
        
        // Set initial game state
        this.blackjackGame.setGameState(GameState.Initial);
        
        // Set background color to a dark green (casino table feel)
        this.scene.clearColor = new Color4(0.05, 0.2, 0.05);
        
        // Create camera - fixed top-down perspective
        const camera = new UniversalCamera("camera", new Vector3(0, 10, 0), this.scene);
        camera.setTarget(Vector3.Zero());
        // Disable camera controls to lock perspective
        camera.inputs.clear();
        
        // Create improved lighting for uniform table illumination
        const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
        light.intensity = 0.7;
        light.diffuse = new Color3(1, 1, 1);
        light.specular = new Color3(0.1, 0.1, 0.1);
        light.groundColor = new Color3(0.5, 0.5, 0.5);
        
        // Create table and card containers
        this.createTable();
        
        // Create deck mesh
        this.deckMesh = this.createDeckMesh();

        // Set up card flip monitoring
        this.blackjackGame.addCardFlipCallback((card: Card) => {
            const mesh = this.cardMeshes.get(card);
            if (mesh) {
                this.flipCard(card, mesh);
            }
        });
        
        // Player cards at bottom of screen
        this.playerCardContainer = new TransformNode("playerCards", this.scene);
        this.playerCardContainer.position = new Vector3(0, 0.2, 2.5);
        
        // Dealer cards at top of screen
        this.dealerCardContainer = new TransformNode("dealerCards", this.scene);
        this.dealerCardContainer.position = new Vector3(0, 0.2, -2.5);
        
        // Create UI with callbacks
        this.gameUI = new GameUI(
            this.scene, 
            this.blackjackGame, 
            onOpenSettings,
            () => this.clearTable()
        );
    }

    private createTable(): void {
        this.table = MeshBuilder.CreateBox("table", { width: 8, height: 0.2, depth: 7 }, this.scene);
        const tableMaterial = new StandardMaterial("tableMaterial", this.scene);
        tableMaterial.diffuseColor = new Color3(0.1, 0.3, 0.1);
        this.table.material = tableMaterial;
        
        // Add felt texture to table
        const tableTop = MeshBuilder.CreateGround("tableTop", { width: 7.5, height: 6.5 }, this.scene);
        const feltMaterial = new StandardMaterial("feltMaterial", this.scene);
        feltMaterial.diffuseColor = new Color3(0.0, 0.25, 0.0);
        tableTop.material = feltMaterial;
        tableTop.position.y = 0.11;
    }

    private createDeckMesh(): Mesh {
        const deckMesh = MeshBuilder.CreateBox("deck", { width: 0.7, height: 0.2, depth: 1 }, this.scene);
        const deckMaterial = new StandardMaterial("deckMaterial", this.scene);
        
        // Use card back texture for top of deck
        const backTexture = new Texture("./assets/textures/playingcards/BACK.png", this.scene);
        deckMaterial.diffuseTexture = backTexture;
        
        deckMesh.material = deckMaterial;
        deckMesh.position = new Vector3(2.5, 0.1, -2.5); // Position at dealer's side
        
        return deckMesh;
    }

    // Create mesh for a single card
    private createCardMesh(card: Card): Mesh {
        // Create a card mesh as a thin box instead of a plane
        const cardMesh = MeshBuilder.CreateBox(`card_${card.getSuit()}_${card.getRank()}`, 
            { width: 0.7, height: 0.01, depth: 1 }, this.scene);
        
        // Create material for the card
        const cardMaterial = new StandardMaterial(`material_${card.getSuit()}_${card.getRank()}`, this.scene);
        
        if (card.isFaceUp()) {
            // Map card rank to texture filename value (1-13)
            let cardValue = 0;
            switch(card.getRank()) {
                case Rank.Ace: cardValue = 1; break;
                case Rank.Two: cardValue = 2; break;
                case Rank.Three: cardValue = 3; break;
                case Rank.Four: cardValue = 4; break;
                case Rank.Five: cardValue = 5; break;
                case Rank.Six: cardValue = 6; break;
                case Rank.Seven: cardValue = 7; break;
                case Rank.Eight: cardValue = 8; break;
                case Rank.Nine: cardValue = 9; break;
                case Rank.Ten: cardValue = 10; break;
                case Rank.Jack: cardValue = 11; break;
                case Rank.Queen: cardValue = 12; break;
                case Rank.King: cardValue = 13; break;
            }
            
            // Create front face texture
            const texturePath = `./assets/textures/playingcards/${card.getSuit().toUpperCase()}_${cardValue}.png`;
            console.log(`Loading card texture: ${texturePath}`);
            const frontTexture = new Texture(texturePath, this.scene);
            cardMaterial.diffuseTexture = frontTexture;
        } else {
            // Card back texture
            const backTexture = new Texture("./assets/textures/playingcards/BACK.png", this.scene);
            cardMaterial.diffuseTexture = backTexture;
        }
        
        // Make sure textures aren't affected by scene lighting
        cardMaterial.specularColor = new Color3(0, 0, 0);
        cardMaterial.emissiveColor = new Color3(1, 1, 1);
        
        cardMesh.material = cardMaterial;
        
        return cardMesh;
    }

    // Update renderCards method in GameScene.ts
    private renderCards(): void {
        // Clear existing card meshes
        this.cardMeshes.forEach((mesh) => {
            mesh.dispose();
        });
        this.cardMeshes.clear();
        
        // Only render cards if not in initial state
        if (this.blackjackGame.getGameState() === GameState.Initial) {
            return;
        }
        
        // Render player cards
        const playerHand = this.blackjackGame.getPlayerHand();
        playerHand.forEach((card, index) => {
            const cardMesh = this.createCardMesh(card);
            cardMesh.position = new Vector3(index * 0.8 - (playerHand.length - 1) * 0.4, 0, 0);
            // Rotate card to face up in top-down view
            cardMesh.rotation.x = Math.PI / 2;
            cardMesh.parent = this.playerCardContainer;
            this.cardMeshes.set(card, cardMesh);
        });
        
        // Render dealer cards
        const dealerHand = this.blackjackGame.getDealerHand();
        dealerHand.forEach((card, index) => {
            const cardMesh = this.createCardMesh(card);
            cardMesh.position = new Vector3(index * 0.8 - (dealerHand.length - 1) * 0.4, 0, 0);
            // Rotate card to face up in top-down view
            cardMesh.rotation.x = Math.PI / 2;
            cardMesh.parent = this.dealerCardContainer;
            this.cardMeshes.set(card, cardMesh);
        });
    }

    private flipCard(card: Card, mesh: Mesh): void {
        // Create animation
        const flipAnimation = new Animation(
            "flipAnimation",
            "rotation.y",
            30,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        
        // Keyframes
        const keyFrames = [];
        keyFrames.push({
            frame: 0,
            value: mesh.rotation.y
        });
        keyFrames.push({
            frame: 15,
            value: mesh.rotation.y + Math.PI / 2
        });
        keyFrames.push({
            frame: 30,
            value: mesh.rotation.y + Math.PI
        });
        
        flipAnimation.setKeys(keyFrames);
        
        // Run animation
        this.scene.beginDirectAnimation(mesh, [flipAnimation], 0, 30, false, 1, () => {
            // Flip the card's state
            card.flip();
            
            // Create a new mesh with the updated texture
            const newMesh = this.createCardMesh(card);
            newMesh.position = mesh.position.clone();
            newMesh.rotation = new Vector3(mesh.rotation.x, mesh.rotation.y + Math.PI, mesh.rotation.z);
            newMesh.parent = mesh.parent;
            
            // Replace old mesh with new one
            this.cardMeshes.delete(card);
            mesh.dispose();
            this.cardMeshes.set(card, newMesh);
        });
    }

    public clearTable(): void {
        // Clear all card meshes
        this.cardMeshes.forEach((mesh) => {
            mesh.dispose();
        });
        this.cardMeshes.clear();
    }

    public update(): void {
        this.renderCards();
        this.gameUI.update();
    }

    public getGameUI(): GameUI {
        return this.gameUI;
    }

    public getScene(): Scene {
        return this.scene;
    }

    public getBlackjackGame(): BlackjackGame {
        return this.blackjackGame;
    }
}
