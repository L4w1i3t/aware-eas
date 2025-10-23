#!/usr/bin/env python3
"""
Compare policy performance across different network reliability conditions.

This script analyzes how each policy handles varying network conditions, from
perfect connectivity to disaster scenarios with degraded or offline networks.

Usage:
    python plot_network_reliability_comparison.py --files file1.csv file2.csv file3.csv [options]
    
The input CSVs should be multi-policy comparison files with different reliability values
but the same seed, scenario, cache size, and other parameters.
"""

import argparse
import sys
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from common import POLICY_COLORS, POLICY_MARKERS, get_winner_label

# Set style
sns.set_style("whitegrid")
plt.rcParams['figure.dpi'] = 150
plt.rcParams['savefig.dpi'] = 300
plt.rcParams['font.size'] = 10
plt.rcParams['axes.labelsize'] = 11
plt.rcParams['axes.titlesize'] = 12
plt.rcParams['legend.fontsize'] = 9

# Unified colors/markers and tie-labeling are imported from common.py


# Network condition labels
NETWORK_CONDITIONS = {
    1.0: 'Perfect (100%)',
    0.95: 'Excellent (95%)',
    0.9: 'Good (90%)',
    0.85: 'Fair (85%)',
    0.8: 'Moderate (80%)',
    0.7: 'Poor (70%)',
    0.6: 'Very Poor (60%)',
    0.5: 'Degraded (50%)',
    0.3: 'Disaster (30%)',
    0.1: 'Critical (10%)',
}


def load_and_combine_data(csv_files):
    """Load multiple CSV files and combine them."""
    dfs = []
    for csv_file in csv_files:
        try:
            df = pd.read_csv(csv_file)
            dfs.append(df)
        except FileNotFoundError:
            print(f"Error: File not found: {csv_file}")
            sys.exit(1)
        except Exception as e:
            print(f"Error loading {csv_file}: {e}")
            sys.exit(1)
    
    combined = pd.concat(dfs, ignore_index=True)
    return combined


def validate_data(df):
    """Validate that the data is suitable for comparison."""
    required_cols = ['policy', 'reliability', 'scenario', 'seed', 'cacheHitRate', 
                     'deliveryRate', 'actionabilityFirstRatio', 'timelinessConsistency']
    missing = [col for col in required_cols if col not in df.columns]
    if missing:
        print(f"Error: Missing required columns: {missing}")
        sys.exit(1)
    
    # Check if we have multiple reliability values
    reliabilities = df['reliability'].unique()
    if len(reliabilities) < 2:
        print("Warning: Only one reliability value found. Comparison requires multiple reliability values.")
        print(f"Found reliability: {reliabilities}")
    
    return True


def get_network_label(reliability):
    """Get a human-readable label for a reliability value."""
    closest = min(NETWORK_CONDITIONS.keys(), key=lambda x: abs(x - reliability))
    if abs(closest - reliability) < 0.01:
        return NETWORK_CONDITIONS[closest]
    return f"{reliability*100:.0f}%"


def plot_reliability_curves(df, metric, metric_label, output_prefix, format='png', higher_is_better=True):
    """Plot how each policy handles different network reliability levels."""
    # Use explicit spacing control here to avoid rare constrained_layout quirks
    fig, ax = plt.subplots(figsize=(13, 7.5))
    
    reliabilities = sorted(df['reliability'].unique())
    policies = df['policy'].unique()
    
    for policy in policies:
        policy_data = df[df['policy'] == policy].sort_values('reliability')
        color = POLICY_COLORS.get(policy, '#6b7280')
        marker = POLICY_MARKERS.get(policy, 'o')
        
        values = policy_data[metric].values
        # Convert to percentage if values are 0-1
        if values.max() <= 1.0 and metric not in ['avgFreshness', 'redundancyIndex']:
            values = values * 100
        
        ax.plot(policy_data['reliability'] * 100, values,
               label=policy, color=color, marker=marker, 
               linewidth=2.5, markersize=8, alpha=0.8)
    
    ax.set_xlabel('Network Reliability (%)', fontweight='bold', fontsize=12)
    
    ylabel = f'{metric_label} (%)' if df[metric].max() <= 1.1 else metric_label
    ax.set_ylabel(ylabel, fontweight='bold', fontsize=12)
    
    ax.set_title(f'{metric_label} vs Network Reliability\nHow Policies Handle Network Degradation',
                fontsize=14, fontweight='bold', pad=15)
    
    ax.legend(loc='best', framealpha=0.95, fontsize=11)
    ax.grid(True, alpha=0.3, linestyle='--')
    
    # Add shaded regions for network conditions
    if len(reliabilities) >= 3:
        ax.axvspan(90, 100, alpha=0.05, color='green')
        ax.axvspan(70, 90, alpha=0.05, color='yellow')
        ax.axvspan(0, 70, alpha=0.05, color='red')
        
        # Add condition labels
    ymax = ax.get_ylim()[1]
    ax.text(95, ymax*0.93, 'Good', ha='center', fontsize=9, alpha=0.6, fontweight='bold')
    ax.text(80, ymax*0.93, 'Fair', ha='center', fontsize=9, alpha=0.6, fontweight='bold')
    ax.text(35, ymax*0.93, 'Poor/Disaster', ha='center', fontsize=9, alpha=0.6, fontweight='bold')
    
    # Set x-axis limits
    ax.set_xlim([reliabilities[0]*100 - 5, 100])
    
    # Adjust layout with extra headroom for top annotations
    fig.subplots_adjust(top=0.9, bottom=0.12, left=0.09, right=0.98)
    output_file = f"{output_prefix}_reliability_{metric}.{format}"
    plt.savefig(output_file, facecolor='white')
    print(f"✓ Saved: {output_file}")
    plt.close()


def plot_all_metrics_grid(df, output_prefix, format='png'):
    """Create a grid showing all key metrics vs network reliability."""
    metrics = [
        ('deliveryRate', 'Delivery Rate', True),
        ('cacheHitRate', 'Cache Hit Rate', True),
        ('actionabilityFirstRatio', 'Actionability', True),
        ('timelinessConsistency', 'Timeliness', True),
        ('avgFreshness', 'Avg Freshness', True),
        ('staleAccessRate', 'Stale Access Rate', False),
    ]
    
    # Filter to metrics that exist
    metrics = [(k, l, h) for k, l, h in metrics if k in df.columns]
    
    n_metrics = len(metrics)
    n_cols = 2
    n_rows = (n_metrics + n_cols - 1) // n_cols
    
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(16, 5*n_rows), constrained_layout=True)
    if n_rows == 1:
        axes = axes.reshape(1, -1)
    axes = axes.flatten()
    
    policies = df['policy'].unique()
    
    for idx, (metric_key, metric_label, higher_better) in enumerate(metrics):
        ax = axes[idx]
        
        for policy in policies:
            policy_data = df[df['policy'] == policy].sort_values('reliability')
            color = POLICY_COLORS.get(policy, '#6b7280')
            marker = POLICY_MARKERS.get(policy, 'o')
            
            values = policy_data[metric_key].values
            # Convert to percentage if values are 0-1
            if values.max() <= 1.0 and metric_key not in ['avgFreshness', 'redundancyIndex']:
                values = values * 100
            
            ax.plot(policy_data['reliability'] * 100, values,
                   label=policy, color=color, marker=marker,
                   linewidth=2, markersize=6, alpha=0.8)
        
        ax.set_xlabel('Network Reliability (%)', fontweight='bold')
        ylabel = f'{metric_label} (%)' if df[metric_key].max() <= 1.1 else metric_label
        ax.set_ylabel(ylabel, fontweight='bold')
        ax.set_title(metric_label, fontweight='bold', fontsize=11)
        ax.grid(True, alpha=0.3)
        ax.legend(loc='best', fontsize=8)
        
        # Color-code background
        ax.axvspan(90, 100, alpha=0.03, color='green')
        ax.axvspan(70, 90, alpha=0.03, color='yellow')
        ax.axvspan(ax.get_xlim()[0], 70, alpha=0.03, color='red')
    
    # Hide extra subplots
    for idx in range(n_metrics, len(axes)):
        axes[idx].axis('off')
    
    scenario = df['scenario'].iloc[0] if 'scenario' in df.columns else 'Unknown'
    fig.suptitle(f'Policy Resilience Analysis Across Network Conditions\nScenario: {scenario}',
                fontsize=15, fontweight='bold', y=0.995)
    
    # Layout automatically handled by constrained_layout
    output_file = f"{output_prefix}_all_metrics_grid.{format}"
    plt.savefig(output_file, facecolor='white')
    print(f"✓ Saved: {output_file}")
    plt.close()


def plot_resilience_analysis(df, output_prefix, format='png'):
    """Analyze which policy is most resilient to network degradation."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6), constrained_layout=True)
    
    reliabilities = sorted(df['reliability'].unique())
    policies = df['policy'].unique()
    
    # Left plot: Performance degradation (compare to perfect network)
    ax1.set_title('Performance Degradation vs Ideal Network\n(Lower is better - maintains performance)', 
                 fontweight='bold', fontsize=12)
    
    for policy in policies:
        policy_data = df[df['policy'] == policy].sort_values('reliability')
        
        # Get performance at highest reliability (baseline)
        max_rel_idx = policy_data['reliability'].idxmax()
        baseline_delivery = policy_data.loc[max_rel_idx, 'deliveryRate']
        baseline_actionability = policy_data.loc[max_rel_idx, 'actionabilityFirstRatio']
        
        # Calculate degradation as % drop from baseline
        delivery_degradation = ((baseline_delivery - policy_data['deliveryRate']) / baseline_delivery * 100)
        actionability_degradation = ((baseline_actionability - policy_data['actionabilityFirstRatio']) / baseline_actionability * 100)
        
        # Average degradation
        avg_degradation = (delivery_degradation + actionability_degradation) / 2
        
        color = POLICY_COLORS.get(policy, '#6b7280')
        marker = POLICY_MARKERS.get(policy, 'o')
        ax1.plot(policy_data['reliability'] * 100, avg_degradation,
                label=policy, color=color, marker=marker, linewidth=2.5, markersize=8, alpha=0.8)
    
    ax1.set_xlabel('Network Reliability (%)', fontweight='bold')
    ax1.set_ylabel('Avg Performance Degradation (%)', fontweight='bold')
    ax1.legend(loc='best')
    ax1.grid(True, alpha=0.3)
    ax1.axhline(y=0, color='gray', linestyle='--', alpha=0.5)
    
    # Right plot: Cache effectiveness under stress
    ax2.set_title('Cache Hit Rate Under Network Stress\n(Higher is better - cache compensates)', 
                 fontweight='bold', fontsize=12)
    for policy in policies:
        policy_data = df[df['policy'] == policy].sort_values('reliability')
        color = POLICY_COLORS.get(policy, '#6b7280')
        marker = POLICY_MARKERS.get(policy, 'o')
        ax2.plot(policy_data['reliability'] * 100, policy_data['cacheHitRate'] * 100,
                label=policy, color=color, marker=marker, linewidth=2.5, markersize=8, alpha=0.8)
    
    ax2.set_xlabel('Network Reliability (%)', fontweight='bold')
    ax2.set_ylabel('Cache Hit Rate (%)', fontweight='bold')
    ax2.legend(loc='best')
    ax2.grid(True, alpha=0.3)
    
    fig.suptitle('Network Resilience Analysis: How Policies Handle Degradation',
                fontsize=14, fontweight='bold', y=1.00)
    
    # Layout automatically handled by constrained_layout
    output_file = f"{output_prefix}_resilience_analysis.{format}"
    plt.savefig(output_file, facecolor='white')
    print(f"✓ Saved: {output_file}")
    plt.close()


def plot_condition_comparison(df, output_prefix, format='png'):
    """Create a comparison showing good vs poor vs disaster network conditions."""
    reliabilities = sorted(df['reliability'].unique())
    
    if len(reliabilities) < 3:
        print("⚠ Skipping condition comparison (need at least 3 reliability levels)")
        return
    
    # Define conditions: good (top quartile), poor (mid), disaster (bottom quartile)
    good_idx = int(len(reliabilities) * 0.75)
    mid_idx = int(len(reliabilities) * 0.5)
    disaster_idx = 0
    
    good_rel = reliabilities[good_idx] if good_idx < len(reliabilities) else reliabilities[-1]
    poor_rel = reliabilities[mid_idx]
    disaster_rel = reliabilities[disaster_idx]
    
    good_data = df[df['reliability'] == good_rel]
    poor_data = df[df['reliability'] == poor_rel]
    disaster_data = df[df['reliability'] == disaster_rel]
    
    metrics = [
        ('deliveryRate', 'Delivery Rate'),
        ('actionabilityFirstRatio', 'Actionability'),
        ('timelinessConsistency', 'Timeliness'),
        ('cacheHitRate', 'Hit Rate'),
    ]
    
    # Filter to existing metrics
    metrics = [(k, l) for k, l in metrics if k in df.columns]
    
    fig, axes = plt.subplots(1, len(metrics), figsize=(4*len(metrics), 6), constrained_layout=True)
    if len(metrics) == 1:
        axes = [axes]
    
    policies = df['policy'].unique()
    x = np.arange(len(policies))
    width = 0.25
    
    for idx, (metric_key, metric_label) in enumerate(metrics):
        ax = axes[idx]
        
        good_values = [good_data[good_data['policy'] == p][metric_key].values[0] for p in policies]
        poor_values = [poor_data[poor_data['policy'] == p][metric_key].values[0] for p in policies]
        disaster_values = [disaster_data[disaster_data['policy'] == p][metric_key].values[0] for p in policies]
        
        # Convert to percentage
        if max(good_values + poor_values + disaster_values) <= 1.0:
            good_values = [v * 100 for v in good_values]
            poor_values = [v * 100 for v in poor_values]
            disaster_values = [v * 100 for v in disaster_values]
        
        bars1 = ax.bar(x - width, good_values, width, 
                      label=f'Good ({good_rel*100:.0f}%)',
                      color='#10b981', alpha=0.8, edgecolor='black', linewidth=0.5)
        bars2 = ax.bar(x, poor_values, width,
                      label=f'Poor ({poor_rel*100:.0f}%)',
                      color='#f59e0b', alpha=0.8, edgecolor='black', linewidth=0.5)
        bars3 = ax.bar(x + width, disaster_values, width,
                      label=f'Disaster ({disaster_rel*100:.0f}%)',
                      color='#ef4444', alpha=0.8, edgecolor='black', linewidth=0.5)
        
        ax.set_ylabel(f'{metric_label} (%)', fontweight='bold')
        ax.set_title(metric_label, fontweight='bold')
        ax.set_xticks(x)
        ax.set_xticklabels(policies, rotation=15, ha='right')
        ax.legend(loc='best', fontsize=8)
        ax.grid(axis='y', alpha=0.3)
        
        # Add value labels
        for bars in [bars1, bars2, bars3]:
            for bar in bars:
                height = bar.get_height()
                ax.text(bar.get_x() + bar.get_width()/2., height,
                       f'{height:.0f}', ha='center', va='bottom', fontsize=7)
    
    fig.suptitle('Network Condition Comparison: Good vs Poor vs Disaster\n(Same Location, Different Network States)',
                fontsize=14, fontweight='bold', y=0.99)
    
    # Layout automatically handled by constrained_layout
    output_file = f"{output_prefix}_condition_comparison.{format}"
    plt.savefig(output_file, facecolor='white')
    print(f"✓ Saved: {output_file}")
    plt.close()


def plot_winner_heatmap(df, output_prefix, format='png'):
    """Create a heatmap showing which policy wins at each reliability level for each metric."""
    metrics = [
        ('deliveryRate', 'Delivery', True),
        ('actionabilityFirstRatio', 'Actionability', True),
        ('timelinessConsistency', 'Timeliness', True),
        ('avgFreshness', 'Freshness', True),
        ('cacheHitRate', 'Hit Rate', True),
    ]
    
    # Filter to existing metrics
    metrics = [(k, l, h) for k, l, h in metrics if k in df.columns]
    
    reliabilities = sorted(df['reliability'].unique())
    
    # Use consistent policy order matching POLICY_COLORS definition
    policy_order = ['LRU', 'TTLOnly', 'PriorityFresh', 'PAFTinyLFU']
    policies = [p for p in policy_order if p in df['policy'].unique()]
    
    # Create winner matrix and labels
    winner_matrix = np.zeros((len(metrics), len(reliabilities)))
    winner_labels = []
    tie_cells = []  # Track cells with ties
    
    for i, (metric_key, _, higher_better) in enumerate(metrics):
        row_labels = []
        for j, reliability in enumerate(reliabilities):
            rel_data = df[df['reliability'] == reliability]
            
            # Get values for all policies
            policy_values = {}
            for policy in policies:
                policy_data = rel_data[rel_data['policy'] == policy]
                if len(policy_data) > 0:
                    value = policy_data[metric_key].values[0]
                    # Invert if lower is better
                    policy_values[policy] = value if higher_better else -value
            
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
                from common import find_policy_by_abbrev
                full = find_policy_by_abbrev(first_winner, list(policies))
                if full:
                    winner_matrix[i, j] = list(policies).index(full)
                tie_cells.append((i, j))
            else:
                # Single winner - find the full policy name
                from common import find_policy_by_abbrev
                full = find_policy_by_abbrev(winner_label, list(policies))
                if full:
                    winner_matrix[i, j] = list(policies).index(full)
        
        winner_labels.append(row_labels)
    
    # Create heatmap
    fig, ax = plt.subplots(figsize=(14, 8), constrained_layout=True)
    
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
    ax.set_xticks(np.arange(len(reliabilities)))
    ax.set_yticks(np.arange(len(metrics)))
    ax.set_xticklabels([f'{r*100:.0f}%' for r in reliabilities])
    ax.set_yticklabels([label for _, label, _ in metrics])
    
    # Add text annotations
    for i in range(len(metrics)):
        for j in range(len(reliabilities)):
            label = winner_labels[i][j]
            # Use smaller font for tie labels
            fontsize = 8 if "/" in label or label == "ANY" else 10
            text = ax.text(j, i, label,
                         ha="center", va="center", color="white", 
                         fontweight='bold', fontsize=fontsize)
    
    ax.set_xlabel('Network Reliability (%)', fontweight='bold', fontsize=12)
    ax.set_ylabel('Metric', fontweight='bold', fontsize=12)
    ax.set_title('Policy Winner by Network Condition and Metric\n(Shows which policy wins at each reliability level)',
                fontsize=14, fontweight='bold', pad=15)
    
    # Add colorbar (exclude gray "ANY" from legend if not used)
    if tie_cells:
        cbar = plt.colorbar(im, ax=ax, ticks=list(range(-1, len(policies))), 
                           orientation='vertical', pad=0.02)
        cbar.set_label('Winning Policy', fontweight='bold')
        labels = ['TIE (ALL)'] + list(policies)
        cbar.ax.set_yticklabels(labels)
    else:
        cbar = plt.colorbar(im, ax=ax, ticks=np.arange(len(policies)), 
                           orientation='vertical', pad=0.02)
        cbar.set_label('Winning Policy', fontweight='bold')
        cbar.ax.set_yticklabels(policies)
    
    # Layout automatically handled by constrained_layout
    output_file = f"{output_prefix}_winner_heatmap.{format}"
    plt.savefig(output_file, facecolor='white')
    print(f"✓ Saved: {output_file}")
    plt.close()


def print_summary_stats(df):
    """Print summary statistics."""
    print("\n" + "="*70)
    print("NETWORK RELIABILITY ANALYSIS")
    print("="*70)
    
    reliabilities = sorted(df['reliability'].unique())
    policies = df['policy'].unique()
    
    print(f"\nReliability levels tested: {[f'{r*100:.0f}%' for r in reliabilities]}")
    print(f"Policies: {', '.join(policies)}")
    
    if 'scenario' in df.columns:
        print(f"Scenario: {df['scenario'].iloc[0]}")
    if 'seed' in df.columns:
        print(f"Seed: {df['seed'].iloc[0]}")
    
    print("\n" + "-"*70)
    print("Performance at Best Network Condition ({:.0f}%):".format(reliabilities[-1]*100))
    print("-"*70)
    
    best_df = df[df['reliability'] == reliabilities[-1]]
    for policy in policies:
        policy_data = best_df[best_df['policy'] == policy].iloc[0]
        print(f"\n{policy}:")
        print(f"  Delivery Rate:    {policy_data['deliveryRate']*100:6.2f}%")
        print(f"  Actionability:    {policy_data['actionabilityFirstRatio']*100:6.2f}%")
        print(f"  Hit Rate:         {policy_data['cacheHitRate']*100:6.2f}%")
    
    print("\n" + "-"*70)
    print("Performance at Worst Network Condition ({:.0f}%):".format(reliabilities[0]*100))
    print("-"*70)
    
    worst_df = df[df['reliability'] == reliabilities[0]]
    for policy in policies:
        policy_data = worst_df[worst_df['policy'] == policy].iloc[0]
        print(f"\n{policy}:")
        print(f"  Delivery Rate:    {policy_data['deliveryRate']*100:6.2f}%")
        print(f"  Actionability:    {policy_data['actionabilityFirstRatio']*100:6.2f}%")
        print(f"  Hit Rate:         {policy_data['cacheHitRate']*100:6.2f}%")
    
    # Calculate resilience (how well performance is maintained)
    print("\n" + "-"*70)
    print("Resilience Scores (Performance Retention):")
    print("-"*70)
    
    for policy in policies:
        policy_df = df[df['policy'] == policy].sort_values('reliability')
        best_delivery = policy_df.iloc[-1]['deliveryRate']
        worst_delivery = policy_df.iloc[0]['deliveryRate']
        retention = (worst_delivery / best_delivery * 100) if best_delivery > 0 else 0
        print(f"\n{policy}: {retention:.1f}% delivery rate retained under worst conditions")
    
    print("\n" + "="*70)


def main():
    parser = argparse.ArgumentParser(
        description='Compare policy performance across different network reliability conditions',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Compare 3 different reliability levels
  python plot_network_reliability_comparison.py --files data/reliability-100.csv data/reliability-85.csv data/reliability-50.csv
  
  # With custom output and PDF format
  python plot_network_reliability_comparison.py --files data/*.csv --output figures/resilience --format pdf --stats
        """
    )
    parser.add_argument('--files', '-f', nargs='+', required=True,
                       help='Paths to multi-policy comparison CSV files (different reliability values)')
    parser.add_argument('--output', '-o', help='Output file prefix (default: network_reliability_comparison)')
    parser.add_argument('--format', choices=['png', 'pdf', 'svg'], default='png',
                       help='Output format (default: png)')
    parser.add_argument('--stats', '-s', action='store_true',
                       help='Print summary statistics')
    
    args = parser.parse_args()
    
    # Determine output prefix
    output_prefix = args.output if args.output else 'network_reliability_comparison'
    
    # Load and combine data
    print(f"Loading {len(args.files)} CSV files...")
    df = load_and_combine_data(args.files)
    validate_data(df)
    
    reliabilities = sorted(df['reliability'].unique())
    policies = df['policy'].unique()
    print(f"Found {len(reliabilities)} reliability levels: {[f'{r*100:.0f}%' for r in reliabilities]}")
    print(f"Found {len(policies)} policies: {', '.join(policies)}")
    
    # Print stats if requested
    if args.stats:
        print_summary_stats(df)
    
    # Generate plots
    print("\nGenerating plots...")
    
    # Individual reliability curves for key metrics
    plot_reliability_curves(df, 'deliveryRate', 'Delivery Rate', 
                           output_prefix, args.format, higher_is_better=True)
    plot_reliability_curves(df, 'actionabilityFirstRatio', 'Actionability-First Ratio', 
                           output_prefix, args.format, higher_is_better=True)
    plot_reliability_curves(df, 'timelinessConsistency', 'Timeliness Consistency', 
                           output_prefix, args.format, higher_is_better=True)
    plot_reliability_curves(df, 'cacheHitRate', 'Cache Hit Rate', 
                           output_prefix, args.format, higher_is_better=True)
    
    # Composite views
    plot_all_metrics_grid(df, output_prefix, args.format)
    plot_resilience_analysis(df, output_prefix, args.format)
    plot_condition_comparison(df, output_prefix, args.format)
    plot_winner_heatmap(df, output_prefix, args.format)
    
    print(f"\n✓ All plots generated successfully!")
    print(f"Output prefix: {output_prefix}")


if __name__ == '__main__':
    main()
