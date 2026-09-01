"""
PyTorch Neural Network for Disaster Time Machine:
Multi-Horizon Recurrent GRU with Temporal Attention and Spatial Feature Fusion
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

class TemporalAttention(nn.Module):
    def __init__(self, hidden_dim):
        super().__init__()
        self.attn = nn.Linear(hidden_dim, 1)

    def forward(self, rnn_outputs):
        # rnn_outputs: (batch_size, seq_len, hidden_dim)
        scores = self.attn(rnn_outputs) # (batch_size, seq_len, 1)
        weights = F.softmax(scores, dim=1) # (batch_size, seq_len, 1)
        context = torch.sum(weights * rnn_outputs, dim=1) # (batch_size, hidden_dim)
        return context, weights

class FloodTimeMachineGRU(nn.Module):
    """
    Flood Time Machine Multi-Horizon Forecasting Model (PyTorch)
    Inputs:
      - Temporal sequence (batch, seq_len=5, n_temporal_features=5)
      - Static/Spatial vector (batch, n_spatial_features=12)
    Outputs:
      - Multi-horizon probabilities [15m, 30m, 60m]
      - Epistemic uncertainty estimate
    """
    def __init__(self, temporal_dim=5, spatial_dim=12, hidden_dim=64, num_layers=2, dropout=0.2):
        super().__init__()
        self.temporal_dim = temporal_dim
        self.spatial_dim = spatial_dim
        self.hidden_dim = hidden_dim

        # Temporal Recurrent Backbone
        self.gru = nn.GRU(
            input_size=temporal_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=True,
            dropout=dropout if num_layers > 1 else 0.0
        )

        self.attention = TemporalAttention(hidden_dim * 2)

        # Spatial / Static Feature Projection
        self.spatial_fc = nn.Sequential(
            nn.Linear(spatial_dim, 32),
            nn.LayerNorm(32),
            nn.ReLU(),
            nn.Dropout(dropout)
        )

        # Fused Representation
        fused_dim = (hidden_dim * 2) + 32
        self.fusion_fc = nn.Sequential(
            nn.Linear(fused_dim, 64),
            nn.LayerNorm(64),
            nn.ReLU(),
            nn.Dropout(dropout)
        )

        # Multi-Horizon Heads
        self.head_15m = nn.Linear(64, 1)
        self.head_30m = nn.Linear(64, 1)
        self.head_60m = nn.Linear(64, 1)

        # Epistemic Uncertainty Estimation Head
        self.uncertainty_head = nn.Linear(64, 3)

    def forward(self, x_seq, x_spatial):
        # x_seq: (batch, seq_len, 5)
        # x_spatial: (batch, 12)
        rnn_out, _ = self.gru(x_seq)
        context, _ = self.attention(rnn_out)

        spatial_feat = self.spatial_fc(x_spatial)
        fused = torch.cat([context, spatial_feat], dim=-1)
        latent = self.fusion_fc(fused)

        prob_15m = torch.sigmoid(self.head_15m(latent))
        prob_30m = torch.sigmoid(self.head_30m(latent))
        prob_60m = torch.sigmoid(self.head_60m(latent))

        uncertainty = F.softplus(self.uncertainty_head(latent)) + 1e-4

        probs = torch.cat([prob_15m, prob_30m, prob_60m], dim=-1)
        return probs, uncertainty
