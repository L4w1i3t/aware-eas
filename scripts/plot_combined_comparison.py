#!/usr/bin/env python3
"""
Compare policy performance across both device capabilities AND network conditions.

This script analyzes the full solution space: how policies perform across all
combinations of device types (cache sizes) and network reliability levels.

Usage:
    python plot_combined_comparison.py --file combined.csv [options]
    
The input CSV should be a combined-comparison file with varying cache sizes
AND reliability values for all policies.
"""

import argparse
import sys
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from common import POLICY_COLORS, get_winner_label, find_policy_by_abbrev, POLICY_ORDER

# Set style
sns.set_style("whitegrid")
plt.rcParams['figure.dpi'] = 150
plt.rcParams['savefig.dpi'] = 300
plt.rcParams['font.size'] = 10
plt.rcParams['axes.labelsize'] = 11
plt.rcParams['axes.titlesize'] = 12
plt.rcParams['legend.fontsize'] = 9

# Styling and winner detection are imported from common.py


def load_data(csv_file):
    """Load the CSV file."""
    try:
        df = pd.read_csv(csv_file)
        return df
    except FileNotFoundError:
        print(f"Error: File not found: {csv_file}")
        sys.exit(1)
    except Exception as e:
        print(f"Error loading {csv_file}: {e}")
        sys.exit(1)


def validate_data(df):
    """Validate that the data is suitable for combined comparison."""
    required_cols = ['policy', 'cacheSize', 'reliability', 'scenario', 'seed', 
                     'cacheHitRate', 'deliveryRate', 'actionabilityFirstRatio', 'timelinessConsistency']
    missing = [col for col in required_cols if col not in df.columns]
    if missing:
        print(f"Error: Missing required columns: {missing}")
        sys.exit(1)
    
    # Check if we have multiple cache sizes AND reliability values
    cache_sizes = df['cacheSize'].unique()
    reliabilities = df['reliability'].unique()
    
    if len(cache_sizes) < 2:
        print("Warning: Only one cache size found. Combined comparison requires multiple cache sizes.")
        print(f"Found cache size: {cache_sizes}")
    
    if len(reliabilities) < 2:
        print("Warning: Only one reliability value found. Combined comparison requires multiple reliability values.")
        print(f"Found reliability: {reliabilities}")
    
    return True


def plot_3d_surface(df, metric, metric_label, output_prefix, format='png'):
    """Create a 3D surface plot showing metric vs cache size vs network reliability."""
    from mpl_toolkits.mplot3d import Axes3D
    from matplotlib import cm
    
    policies = df['policy'].unique()
    n_policies = len(policies)

    # Dynamic grid based on number of policies
    n_cols = 2
    n_rows = (n_policies + n_cols - 1) // n_cols
    fig = plt.figure(figsize=(18, 5 * n_rows))

    for idx, policy in enumerate(policies):
        ax = fig.add_subplot(n_rows, n_cols, idx + 1, projection='3d')
        
        policy_data = df[df['policy'] == policy]
        
        # Create meshgrid
        cache_sizes = sorted(policy_data['cacheSize'].unique())
        reliabilities = sorted(policy_data['reliability'].unique())
        
        X, Y = np.meshgrid(cache_sizes, [r * 100 for r in reliabilities])
        Z = np.zeros_like(X, dtype=float)
        
        for i, rel in enumerate(reliabilities):
            for j, cache in enumerate(cache_sizes):
                value = policy_data[(policy_data['cacheSize'] == cache) & 
                                   (policy_data['reliability'] == rel)][metric].values
                if len(value) > 0:
                    Z[i, j] = value[0] * 100 if value[0] <= 1.0 else value[0]
        
        # Plot surface
        color = POLICY_COLORS.get(policy, '#6b7280')
        surf = ax.plot_surface(X, Y, Z, cmap=cm.viridis, alpha=0.8, 
                              edgecolor='none', linewidth=0, antialiased=True)
        
        ax.set_xlabel('Cache Size', fontweight='bold')
        ax.set_ylabel('Network Reliability (%)', fontweight='bold')
        ax.set_zlabel(f'{metric_label} (%)', fontweight='bold')
        ax.set_title(f'{policy}', fontweight='bold', fontsize=13, pad=10)
        
        # Add colorbar
        fig.colorbar(surf, ax=ax, shrink=0.5, aspect=5)
    
    fig.suptitle(f'{metric_label} Across Device Capabilities and Network Conditions',
                fontsize=15, fontweight='bold', y=0.98)
    
    plt.tight_layout(rect=[0, 0, 1, 0.97])
    output_file = f"{output_prefix}_3d_surface_{metric}.{format}"
    plt.savefig(output_file, bbox_inches='tight', facecolor='white')
    print(f"✓ Saved: {output_file}")
    plt.close()


def plot_heatmap_matrix(df, metric, metric_label, output_prefix, format='png'):
    """Create heatmap matrices showing metric for each policy across device × network grid."""
    policies = df['policy'].unique()
    cache_sizes = sorted(df['cacheSize'].unique())
    reliabilities = sorted(df['reliability'].unique())

    # Dynamic grid based on number of policies
    n_cols = 2
    n_rows = (len(policies) + n_cols - 1) // n_cols
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(16, 6 * n_rows))
    if n_rows == 1:
        axes = axes.reshape(1, -1)
    axes = axes.flatten()
    
    for idx, policy in enumerate(policies):
        ax = axes[idx]
        policy_data = df[df['policy'] == policy]
        
        # Create matrix
        matrix = np.zeros((len(reliabilities), len(cache_sizes)))
        for i, rel in enumerate(reliabilities):
            for j, cache in enumerate(cache_sizes):
                value = policy_data[(policy_data['cacheSize'] == cache) & 
                                   (policy_data['reliability'] == rel)][metric].values
                if len(value) > 0:
                    matrix[i, j] = value[0] * 100 if value[0] <= 1.0 else value[0]
        
        # Plot heatmap
        im = ax.imshow(matrix, cmap='RdYlGn', aspect='auto', vmin=0, vmax=100)
        
        # Set ticks
        ax.set_xticks(np.arange(len(cache_sizes)))
        ax.set_yticks(np.arange(len(reliabilities)))
        ax.set_xticklabels(cache_sizes)
        ax.set_yticklabels([f'{r*100:.0f}%' for r in reliabilities])
        
        # Add text annotations
        for i in range(len(reliabilities)):
            for j in range(len(cache_sizes)):
                text = ax.text(j, i, f'{matrix[i, j]:.0f}',
                             ha="center", va="center", color="black" if matrix[i, j] > 50 else "white",
                             fontsize=9, fontweight='bold')
        
        ax.set_xlabel('Cache Size (entries)', fontweight='bold')
        ax.set_ylabel('Network Reliability', fontweight='bold')
        ax.set_title(f'{policy}', fontweight='bold', fontsize=12)
        
        # Add colorbar
        plt.colorbar(im, ax=ax, label=f'{metric_label} (%)')
    
    fig.suptitle(f'{metric_label}: Device × Network Performance Matrix',
                fontsize=15, fontweight='bold', y=0.995)
    
    plt.tight_layout(rect=[0, 0, 1, 0.99])
    output_file = f"{output_prefix}_heatmap_matrix_{metric}.{format}"
    plt.savefig(output_file, bbox_inches='tight', facecolor='white')
    print(f"✓ Saved: {output_file}")
    plt.close()


def plot_winner_cube(df, metric, metric_label, output_prefix, format='png'):
    """Create a heatmap showing which policy wins at each (cache, reliability) combination."""
    cache_sizes = sorted(df['cacheSize'].unique())
    reliabilities = sorted(df['reliability'].unique())
    
    # Use consistent policy order matching POLICY_COLORS definition
    policy_order = ['LRU', 'TTLOnly', 'PriorityFresh', 'PAFTinyLFU']
    policies = [p for p in policy_order if p in df['policy'].unique()]
    
    fig, ax = plt.subplots(figsize=(14, 10))
    
    # Create winner matrix and labels
    winner_matrix = np.zeros((len(reliabilities), len(cache_sizes)))
    winner_labels = []
    tie_cells = []  # Track cells with ties
    
    for i, rel in enumerate(reliabilities):
        row_labels = []
        for j, cache in enumerate(cache_sizes):
            combo_data = df[(df['cacheSize'] == cache) & (df['reliability'] == rel)]
            
            # Get values for all policies
            policy_values = {}
            for policy in policies:
                policy_data = combo_data[combo_data['policy'] == policy]
                if len(policy_data) > 0:
                    policy_values[policy] = policy_data[metric].values[0]
            
            # Determine winner label (handles ties)
            winner_label = get_winner_label(policy_values)
            row_labels.append(winner_label)
            
            # For coloring, use first winner or gray for "ANY"
            if winner_label == "ANY":
                winner_matrix[i, j] = -1  # Special value for ties
                tie_cells.append((i, j))
            elif "/" in winner_label:
                # Multiple winners but not all - use first winner's color
                first_winner = winner_label.split("/")[0]
                full = find_policy_by_abbrev(first_winner, policies)
                if full:
                    winner_matrix[i, j] = list(policies).index(full)
                tie_cells.append((i, j))
            else:
                # Single winner - find the full policy name
                full = find_policy_by_abbrev(winner_label, policies)
                if full:
                    winner_matrix[i, j] = list(policies).index(full)
        
        winner_labels.append(row_labels)
    
    # Custom colormap (add gray for "ANY")
    # Build color list in the same order as policies to ensure correct mapping
    policy_colors_list = []
    for p in policies:
        policy_colors_list.append(POLICY_COLORS.get(p, '#6b7280'))
    policy_colors_list.append('#6b7280')  # Gray for "ANY"
    from matplotlib.colors import ListedColormap, BoundaryNorm
    cmap = ListedColormap(policy_colors_list)
    bounds = list(range(-1, len(policies))) + [len(policies)]
    norm = BoundaryNorm(bounds, cmap.N)
    
    im = ax.imshow(winner_matrix, cmap=cmap, norm=norm, aspect='auto')
    
    # Set ticks
    ax.set_xticks(np.arange(len(cache_sizes)))
    ax.set_yticks(np.arange(len(reliabilities)))
    ax.set_xticklabels(cache_sizes)
    ax.set_yticklabels([f'{r*100:.0f}%' for r in reliabilities])
    
    # Add text annotations
    for i in range(len(reliabilities)):
        for j in range(len(cache_sizes)):
            label = winner_labels[i][j]
            # Use smaller font for tie labels
            fontsize = 9 if "/" in label or label == "ANY" else 11
            text = ax.text(j, i, label,
                         ha="center", va="center", color="white", 
                         fontweight='bold', fontsize=fontsize)
    
    ax.set_xlabel('Cache Size (Device Capability)', fontweight='bold', fontsize=12)
    ax.set_ylabel('Network Reliability', fontweight='bold', fontsize=12)
    ax.set_title(f'Policy Winner Matrix: {metric_label}\n(Shows optimal policy for each Device × Network combination)',
                fontsize=14, fontweight='bold', pad=15)
    
    # Add colorbar (exclude gray "ANY" from legend if not used)
    if tie_cells:
        cbar = plt.colorbar(im, ax=ax, ticks=list(range(-1, len(policies))), orientation='vertical', pad=0.02)
        cbar.set_label('Winning Policy', fontweight='bold', fontsize=11)
        labels = ['TIE (ALL)'] + list(policies)
        cbar.ax.set_yticklabels(labels)
    else:
        cbar = plt.colorbar(im, ax=ax, ticks=np.arange(len(policies)), orientation='vertical', pad=0.02)
        cbar.set_label('Winning Policy', fontweight='bold', fontsize=11)
        cbar.ax.set_yticklabels(policies)
    
    # Add scenario annotations
    ax.text(-0.5, len(reliabilities) - 0.5, 'High-end\nPerfect Net', 
           ha='right', va='center', fontsize=9, alpha=0.6, style='italic')
    ax.text(-0.5, 0, 'Disaster\nScenario', 
           ha='right', va='center', fontsize=9, alpha=0.6, style='italic')
    ax.text(len(cache_sizes) - 0.5, -0.5, 'High-end\nDevice', 
           ha='center', va='bottom', fontsize=9, alpha=0.6, style='italic')
    ax.text(0, -0.5, 'Budget\nDevice', 
           ha='center', va='bottom', fontsize=9, alpha=0.6, style='italic')
    
    plt.tight_layout()
    output_file = f"{output_prefix}_winner_cube_{metric}.{format}"
    plt.savefig(output_file, bbox_inches='tight', facecolor='white')
    print(f"✓ Saved: {output_file}")
    plt.close()


def plot_extreme_scenarios(df, output_prefix, format='png'):
    """Compare performance in extreme scenarios: best case vs worst case."""
    cache_sizes = sorted(df['cacheSize'].unique())
    reliabilities = sorted(df['reliability'].unique())
    
    best_cache = cache_sizes[-1]
    worst_cache = cache_sizes[0]
    best_network = reliabilities[-1]
    worst_network = reliabilities[0]
    
    # Define scenarios
    scenarios = {
        'Best Case\n(High-end + Perfect)': (best_cache, best_network),
        'Good Device\nPoor Network': (best_cache, worst_network),
        'Budget Device\nGood Network': (worst_cache, best_network),
        'Worst Case\n(Budget + Disaster)': (worst_cache, worst_network)
    }
    
    metrics = [
        ('deliveryRate', 'Delivery Rate'),
        ('actionabilityFirstRatio', 'Actionability'),
        ('cacheHitRate', 'Hit Rate'),
    ]
    
    # Filter to existing metrics
    metrics = [(k, l) for k, l in metrics if k in df.columns]
    
    fig, axes = plt.subplots(1, len(metrics), figsize=(6*len(metrics), 7))
    if len(metrics) == 1:
        axes = [axes]
    
    # Use consistent policy order matching POLICY_COLORS definition
    policy_order = ['LRU', 'TTLOnly', 'PriorityFresh', 'PAFTinyLFU']
    policies = [p for p in policy_order if p in df['policy'].unique()]
    x = np.arange(len(scenarios))
    width = 0.2
    
    for idx, (metric_key, metric_label) in enumerate(metrics):
        ax = axes[idx]
        
        for p_idx, policy in enumerate(policies):
            values = []
            for scenario_name, (cache, net) in scenarios.items():
                value = df[(df['policy'] == policy) & 
                          (df['cacheSize'] == cache) & 
                          (df['reliability'] == net)][metric_key].values
                if len(value) > 0:
                    val = value[0] * 100 if value[0] <= 1.0 else value[0]
                    values.append(val)
                else:
                    values.append(0)
            
            color = POLICY_COLORS.get(policy, '#6b7280')
            offset = (p_idx - len(policies)/2 + 0.5) * width
            bars = ax.bar(x + offset, values, width, label=policy, color=color, alpha=0.8, edgecolor='black', linewidth=0.5)
            
            # Add value labels
            for bar in bars:
                height = bar.get_height()
                ax.text(bar.get_x() + bar.get_width()/2., height,
                       f'{height:.0f}', ha='center', va='bottom', fontsize=8)
        
        # Add winner annotations for each scenario
        scenario_names = list(scenarios.keys())
        for s_idx, (scenario_name, (cache, net)) in enumerate(scenarios.items()):
            # Get values for all policies in this scenario
            policy_values = {}
            for policy in policies:
                value = df[(df['policy'] == policy) & 
                          (df['cacheSize'] == cache) & 
                          (df['reliability'] == net)][metric_key].values
                if len(value) > 0:
                    policy_values[policy] = value[0]
            
            winner_label = get_winner_label(policy_values)
            
            # Place winner label at top of chart
            ax.text(s_idx, 102, f'► {winner_label}', ha='center', va='bottom', 
                   fontsize=9, fontweight='bold', color='#d97706',
                   bbox=dict(boxstyle='round,pad=0.3', facecolor='#fef3c7', edgecolor='#d97706', linewidth=1))
        
        ax.set_ylabel(f'{metric_label} (%)', fontweight='bold')
        ax.set_title(metric_label, fontweight='bold', fontsize=12)
        ax.set_xticks(x)
        ax.set_xticklabels(scenarios.keys(), rotation=0, ha='center', fontsize=10)
        ax.legend(loc='best', fontsize=9)
        ax.grid(axis='y', alpha=0.3)
        ax.set_ylim([0, 110])  # Increased to make room for winner labels
    
    fig.suptitle('Extreme Scenario Comparison\n(How policies perform in best/worst device × network combinations)',
                fontsize=14, fontweight='bold', y=0.98)
    
    plt.tight_layout(rect=[0, 0, 1, 0.96])
    output_file = f"{output_prefix}_extreme_scenarios.{format}"
    plt.savefig(output_file, bbox_inches='tight', facecolor='white')
    print(f"✓ Saved: {output_file}")
    plt.close()


def plot_policy_recommendation_tree(df, output_prefix, format='png'):
    """Create a decision tree showing which policy to use in each scenario."""
    cache_sizes = sorted(df['cacheSize'].unique())
    reliabilities = sorted(df['reliability'].unique())
    
    # Divide into regions
    mid_cache = cache_sizes[len(cache_sizes)//2]
    mid_reliability = reliabilities[len(reliabilities)//2]
    
    regions = {
        'High Cache\nGood Network': (lambda c, r: c >= mid_cache and r >= mid_reliability, []),
        'High Cache\nPoor Network': (lambda c, r: c >= mid_cache and r < mid_reliability, []),
        'Low Cache\nGood Network': (lambda c, r: c < mid_cache and r >= mid_reliability, []),
        'Low Cache\nPoor Network': (lambda c, r: c < mid_cache and r < mid_reliability, []),
    }
    
    # Find best policy for each region
    for region_name, (condition, winners) in regions.items():
        region_winners = {}
        for cache in cache_sizes:
            for rel in reliabilities:
                if condition(cache, rel):
                    combo_data = df[(df['cacheSize'] == cache) & (df['reliability'] == rel)]
                    for policy in combo_data['policy'].unique():
                        policy_data = combo_data[combo_data['policy'] == policy]
                        score = (policy_data['deliveryRate'].values[0] + 
                                policy_data['actionabilityFirstRatio'].values[0]) / 2
                        if policy not in region_winners:
                            region_winners[policy] = []
                        region_winners[policy].append(score)
        
        # Average scores and check for ties
        avg_winners = {p: np.mean(scores) for p, scores in region_winners.items()}
        winner_label = get_winner_label(avg_winners)
        best_score = max(avg_winners.values())
        regions[region_name] = (condition, winner_label, best_score)
    
    # Create visualization
    fig, ax = plt.subplots(figsize=(14, 10))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 10)
    ax.axis('off')
    
    # Title
    ax.text(5, 9.5, 'Policy Recommendation Decision Tree', 
           ha='center', fontsize=16, fontweight='bold')
    ax.text(5, 9, 'Choose the best policy based on your device and network conditions',
           ha='center', fontsize=11, alpha=0.7)
    
    # Draw tree
    # Root
    ax.add_patch(plt.Rectangle((4, 7.5), 2, 0.8, facecolor='#1e3a8a', edgecolor='black', linewidth=2))
    ax.text(5, 7.9, 'Device Capability?', ha='center', va='center', color='white', fontsize=11, fontweight='bold')
    
    # Level 1 - Cache size branches
    ax.plot([5, 2.5], [7.5, 6.5], 'k-', linewidth=2)
    ax.plot([5, 7.5], [7.5, 6.5], 'k-', linewidth=2)
    
    ax.add_patch(plt.Rectangle((1.5, 6), 2, 0.6, facecolor='#1e40af', edgecolor='black', linewidth=1.5))
    ax.text(2.5, 6.3, f'Low Cache\n(< {mid_cache})', ha='center', va='center', fontsize=10, fontweight='bold')
    
    ax.add_patch(plt.Rectangle((6.5, 6), 2, 0.6, facecolor='#1e40af', edgecolor='black', linewidth=1.5))
    ax.text(7.5, 6.3, f'High Cache\n(≥ {mid_cache})', ha='center', va='center', fontsize=10, fontweight='bold')
    
    # Level 2 - Network branches
    ax.plot([2.5, 1.25], [6, 4.8], 'k-', linewidth=1.5)
    ax.plot([2.5, 3.75], [6, 4.8], 'k-', linewidth=1.5)
    ax.plot([7.5, 6.25], [6, 4.8], 'k-', linewidth=1.5)
    ax.plot([7.5, 8.75], [6, 4.8], 'k-', linewidth=1.5)
    
    # Leaves - Recommendations
    recommendations = [
        ('Low Cache\nPoor Network', 0.5, regions['Low Cache\nPoor Network']),
        ('Low Cache\nGood Network', 3, regions['Low Cache\nGood Network']),
        ('High Cache\nPoor Network', 5.5, regions['High Cache\nPoor Network']),
        ('High Cache\nGood Network', 8, regions['High Cache\nGood Network']),
    ]
    
    for scenario, x_pos, (_, winner_label, score) in recommendations:
        # Use first policy's color for display (or gray for ANY)
        if winner_label == "ANY":
            color = '#6b7280'
        elif "/" in winner_label:
            # Use color of first winner
            abbrev = winner_label.split("/")[0]
            first_policy = find_policy_by_abbrev(abbrev, list(df['policy'].unique()))
            color = POLICY_COLORS.get(first_policy, '#6b7280')
        else:
            # Single winner - find full policy name
            full_policy = find_policy_by_abbrev(winner_label, list(df['policy'].unique()))
            color = POLICY_COLORS.get(full_policy, '#6b7280')
        
        ax.add_patch(plt.Rectangle((x_pos, 3.5), 2, 1, facecolor=color, edgecolor='black', linewidth=2, alpha=0.9))
        
        # Adjust font size for tie labels
        fontsize = 9 if "/" in winner_label or winner_label == "ANY" else 11
        ax.text(x_pos + 1, 4.3, f'Use {winner_label}', ha='center', va='center', 
               color='white', fontsize=fontsize, fontweight='bold')
        ax.text(x_pos + 1, 3.9, f'Score: {score*100:.0f}%', ha='center', va='center',
               color='white', fontsize=9, alpha=0.9)
        ax.text(x_pos + 1, 3.2, scenario.replace('\n', ' '), ha='center', va='top',
               fontsize=8, alpha=0.7)
    
    # Legend
    legend_y = 1.5
    ax.text(5, legend_y + 0.5, 'Network Reliability Thresholds:', ha='center', fontsize=10, fontweight='bold')
    ax.text(5, legend_y, f'Good: ≥ {mid_reliability*100:.0f}%  |  Poor: < {mid_reliability*100:.0f}%',
           ha='center', fontsize=9, alpha=0.7)
    ax.text(5, legend_y - 0.4, 'Note: Labels like "LRU/PAF" indicate tie between policies; "ANY" means all policies tied',
           ha='center', fontsize=8, alpha=0.6, style='italic')
    
    plt.tight_layout()
    output_file = f"{output_prefix}_recommendation_tree.{format}"
    plt.savefig(output_file, bbox_inches='tight', facecolor='white')
    print(f"✓ Saved: {output_file}")
    plt.close()


def print_summary_stats(df):
    """Print summary statistics."""
    print("\n" + "="*70)
    print("COMBINED DEVICE × NETWORK ANALYSIS")
    print("="*70)
    
    cache_sizes = sorted(df['cacheSize'].unique())
    reliabilities = sorted(df['reliability'].unique())
    policies = df['policy'].unique()
    
    print(f"\nCache sizes: {cache_sizes}")
    print(f"Network reliabilities: {[f'{r*100:.0f}%' for r in reliabilities]}")
    print(f"Policies: {', '.join(policies)}")
    print(f"Total combinations: {len(cache_sizes)} devices × {len(reliabilities)} networks = {len(cache_sizes) * len(reliabilities)} scenarios per policy")
    
    if 'scenario' in df.columns:
        print(f"Scenario: {df['scenario'].iloc[0]}")
    if 'seed' in df.columns:
        print(f"Seed: {df['seed'].iloc[0]}")
    
    # Best and worst case
    best_cache = cache_sizes[-1]
    worst_cache = cache_sizes[0]
    best_network = reliabilities[-1]
    worst_network = reliabilities[0]
    
    print("\n" + "-"*70)
    print(f"BEST CASE (Cache={best_cache}, Network={best_network*100:.0f}%):")
    print("-"*70)
    
    best_case = df[(df['cacheSize'] == best_cache) & (df['reliability'] == best_network)]
    for policy in policies:
        p_data = best_case[best_case['policy'] == policy].iloc[0]
        print(f"\n{policy}:")
        print(f"  Delivery:         {p_data['deliveryRate']*100:6.2f}%")
        print(f"  Actionability:    {p_data['actionabilityFirstRatio']*100:6.2f}%")
        print(f"  Hit Rate:         {p_data['cacheHitRate']*100:6.2f}%")
    
    print("\n" + "-"*70)
    print(f"WORST CASE (Cache={worst_cache}, Network={worst_network*100:.0f}%):")
    print("-"*70)
    
    worst_case = df[(df['cacheSize'] == worst_cache) & (df['reliability'] == worst_network)]
    for policy in policies:
        p_data = worst_case[worst_case['policy'] == policy].iloc[0]
        print(f"\n{policy}:")
        print(f"  Delivery:         {p_data['deliveryRate']*100:6.2f}%")
        print(f"  Actionability:    {p_data['actionabilityFirstRatio']*100:6.2f}%")
        print(f"  Hit Rate:         {p_data['cacheHitRate']*100:6.2f}%")
    
    # Performance spread
    print("\n" + "-"*70)
    print("PERFORMANCE RANGE ACROSS ALL CONDITIONS:")
    print("-"*70)
    
    for policy in policies:
        p_data = df[df['policy'] == policy]
        min_delivery = p_data['deliveryRate'].min() * 100
        max_delivery = p_data['deliveryRate'].max() * 100
        spread = max_delivery - min_delivery
        print(f"\n{policy}: {min_delivery:.1f}% to {max_delivery:.1f}% (spread: {spread:.1f}%)")
    
    print("\n" + "="*70)


def main():
    parser = argparse.ArgumentParser(
        description='Analyze policy performance across device capabilities AND network conditions',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Analyze combined comparison data
  python plot_combined_comparison.py --file data/combined-comparison.csv
  
  # With custom output and PDF format
  python plot_combined_comparison.py --file data/combined.csv --output figures/combined --format pdf --stats
        """
    )
    parser.add_argument('--file', '-f', required=True,
                       help='Path to combined comparison CSV file')
    parser.add_argument('--output', '-o', help='Output file prefix (default: combined_comparison)')
    parser.add_argument('--format', choices=['png', 'pdf', 'svg'], default='png',
                       help='Output format (default: png)')
    parser.add_argument('--stats', '-s', action='store_true',
                       help='Print summary statistics')
    
    args = parser.parse_args()
    
    # Determine output prefix
    output_prefix = args.output if args.output else 'combined_comparison'
    
    # Load data
    print(f"Loading {args.file}...")
    df = load_data(args.file)
    validate_data(df)
    
    cache_sizes = sorted(df['cacheSize'].unique())
    reliabilities = sorted(df['reliability'].unique())
    policies = df['policy'].unique()
    
    print(f"Found {len(cache_sizes)} cache sizes: {cache_sizes}")
    print(f"Found {len(reliabilities)} reliability levels: {[f'{r*100:.0f}%' for r in reliabilities]}")
    print(f"Found {len(policies)} policies: {', '.join(policies)}")
    print(f"Total scenarios: {len(cache_sizes) * len(reliabilities)} per policy")
    
    # Print stats if requested
    if args.stats:
        print_summary_stats(df)
    
    # Generate plots
    print("\nGenerating plots...")
    
    # 3D surface plots for key metrics
    plot_3d_surface(df, 'deliveryRate', 'Delivery Rate', output_prefix, args.format)
    plot_3d_surface(df, 'actionabilityFirstRatio', 'Actionability', output_prefix, args.format)
    
    # Heatmap matrices
    plot_heatmap_matrix(df, 'deliveryRate', 'Delivery Rate', output_prefix, args.format)
    plot_heatmap_matrix(df, 'actionabilityFirstRatio', 'Actionability', output_prefix, args.format)
    plot_heatmap_matrix(df, 'cacheHitRate', 'Cache Hit Rate', output_prefix, args.format)
    
    # Winner cubes
    plot_winner_cube(df, 'deliveryRate', 'Delivery Rate', output_prefix, args.format)
    plot_winner_cube(df, 'actionabilityFirstRatio', 'Actionability', output_prefix, args.format)
    
    # Extreme scenarios and recommendations
    plot_extreme_scenarios(df, output_prefix, args.format)
    plot_policy_recommendation_tree(df, output_prefix, args.format)
    
    print(f"\n✓ All plots generated successfully!")
    print(f"Output prefix: {output_prefix}")


if __name__ == '__main__':
    main()
