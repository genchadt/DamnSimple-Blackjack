// src/constants.ts
import { Vector3 } from "@babylonjs/core";

// --- Card Dimensions & Scaling ---
const CARD_SCALE = 0.8;
const CARD_ASPECT_RATIO = 1.4; // Standard playing card height/width ratio

// --- Game Rules ---
const DEFAULT_FUNDS = 1000;
const MIN_BET = 10;
const DEFAULT_BET = MIN_BET; // Default bet is the minimum bet
const BET_INCREMENT = 10;
const MIN_CARDS_BEFORE_SHUFFLE = 15; // Deck reshuffle threshold
const DEALER_STAND_SCORE = 17; // Dealer must stand on 17 or higher

// --- Layout Positions (Z-axis is depth from camera) ---
const PLAYER_HAND_Z = 2.2;
const DEALER_HAND_Z = -2.2;
const DECK_POSITION_X = 4.0;
const DECK_POSITION_Z = -2.5;
const CARD_Y_POS = 0.05; // How high cards sit off the table surface
const DECK_DISPENSER_Y_OFFSET = 0.10; // How high the center of the dispenser is above CARD_Y_POS

// --- Card Visuals & Spacing ---
const CARD_WIDTH = 1.0 * CARD_SCALE;
const CARD_HEIGHT = CARD_WIDTH * CARD_ASPECT_RATIO;
const CARD_DEPTH = 0.02 * CARD_SCALE; // Thickness scales too
const CARD_CORNER_RADIUS = 0.08 * CARD_SCALE; // Rounded corners scale
const CARD_SPACING = CARD_WIDTH + 0.15; // Horizontal space between cards in hand
const CARD_STACK_OFFSET = CARD_DEPTH + 0.002; // Vertical offset for cards in hand

// --- Animation ---
const FPS = 60;
const DEAL_SLIDE_DURATION_MS = 450;
const DEAL_ROTATION_DURATION_MS = 400;
const REPOSITION_DURATION_MS = DEAL_SLIDE_DURATION_MS; // Match deal slide speed
const FLIP_DURATION_MS = 350;

// --- Assets ---
const TEXTURE_BASE_PATH = "assets/textures/playingcards/";

/**
 * Defines common constants used throughout the application.
 */
export const Constants = {
    // Game Rules
    DEFAULT_FUNDS,
    MIN_BET,
    DEFAULT_BET,
    BET_INCREMENT,
    MIN_CARDS_BEFORE_SHUFFLE,
    DEALER_STAND_SCORE,

    // Layout
    PLAYER_HAND_Z,
    DEALER_HAND_Z,
    DECK_POSITION_X,
    DECK_POSITION_Z,
    CARD_Y_POS, // Y position of cards flat on table
    DECK_DISPENSER_Y_OFFSET, // Offset for the dispenser center relative to card Y pos

    // Card Visuals
    CARD_SCALE,
    CARD_ASPECT_RATIO,
    CARD_WIDTH,
    CARD_HEIGHT,
    CARD_DEPTH,
    CARD_CORNER_RADIUS,
    CARD_SPACING,
    CARD_STACK_OFFSET,

    // Animation
    FPS,
    DEAL_SLIDE_DURATION_MS,
    DEAL_ROTATION_DURATION_MS,
    REPOSITION_DURATION_MS,
    FLIP_DURATION_MS,

    // Assets
    TEXTURE_BASE_PATH,
};

// Pre-calculated Vector3 for the Deck's XZ position
export const DefaultDeckPositionXZ = new Vector3(
    Constants.DECK_POSITION_X,
    0, // Y is set dynamically based on table height + offsets
    Constants.DECK_POSITION_Z
);
