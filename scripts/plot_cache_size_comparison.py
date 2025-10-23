
"""
Compare policy performance across different cache sizes (device capabilities).

This script analyzes how each policy scales with different hardware constraints,
simulating scenarios like a high-end PC vs a consumer smartphone in the same location.

Usage:
    python plot_cache_size_comparison.py --files file1.csv file2.csv file3.csv [options]
    
The input CSVs should be multi-policy comparison files with different cache sizes
but the same seed, scenario, and other parameters.
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
    required_cols = ['policy', 'cacheSize', 'scenario', 'seed', 'cacheHitRate', 
                     'actionabilityFirstRatio', 'timelinessConsistency', 'avgFreshness']
    missing = [col for col in required_cols if col not in df.columns]
    if missing:
        print(f"Error: Missing required columns: {missing}")
        sys.exit(1)
    
    # Check if we have multiple cache sizes
    cache_sizes = df['cacheSize'].unique()
    if len(cache_sizes) < 2:
        print("Warning: Only one cache size found. Comparison requires multiple cache sizes.")
        print(f"Found cache size: {cache_sizes}")
    
    return True


def plot_scaling_curves(df, metric, metric_label, output_prefix, format='png', higher_is_better=True):
    """Plot how each policy scales with cache size for a specific metric."""
    fig, ax = plt.subplots(figsize=(12, 7))
    
    cache_sizes = sorted(df['cacheSize'].unique())
    policies = df['policy'].unique()
    
    for policy in policies:
        policy_data = df[df['policy'] == policy].sort_values('cacheSize')
        color = POLICY_COLORS.get(policy, '#6b7280')
        marker = POLICY_MARKERS.get(policy, 'o')
        
        values = policy_data[metric].values
        # Convert to percentage if values are 0-1
        if values.max() <= 1.0 and metric != 'avgFreshness':
            values = values * 100
        
        ax.plot(policy_data['cacheSize'], values,
               label=policy, color=color, marker=marker, 
               linewidth=2.5, markersize=8, alpha=0.8)
    
    ax.set_xlabel('Cache Size (entries)', fontweight='bold', fontsize=12)
    
    ylabel = f'{metric_label} (%)' if df[metric].max() <= 1.1 else metric_label
    ax.set_ylabel(ylabel, fontweight='bold', fontsize=12)
    
    ax.set_title(f'{metric_label} vs Cache Size\nHow Policies Scale with Device Capabilities',
                fontsize=14, fontweight='bold', pad=15)
    
    ax.legend(loc='best', framealpha=0.95, fontsize=11)
    ax.grid(True, alpha=0.3, linestyle='--')
    
    # Add device capability annotations
    min_size = cache_sizes[0]
    max_size = cache_sizes[-1]
    
    # Add shaded regions for device types
    if len(cache_sizes) >= 3:
        mid = len(cache_sizes) // 2
        low_threshold = cache_sizes[mid-1] if mid > 0 else cache_sizes[0]
        high_threshold = cache_sizes[mid+1] if mid < len(cache_sizes)-1 else cache_sizes[-1]
        
        ax.axvspan(min_size, low_threshold, alpha=0.05, color='red')
        ax.axvspan(high_threshold, max_size, alpha=0.05, color='green')
        
        # Add labels
        ax.text(min_size + (low_threshold-min_size)/2, ax.get_ylim()[1]*0.95, 
               'Low-end\n(e.g., old smartphone)', ha='center', fontsize=9, alpha=0.6)
        ax.text(high_threshold + (max_size-high_threshold)/2, ax.get_ylim()[1]*0.95,
               'High-end\n(e.g., modern PC)', ha='center', fontsize=9, alpha=0.6)
    
    plt.tight_layout()
    output_file = f"{output_prefix}_scaling_{metric}.{format}"
    plt.savefig(output_file, bbox_inches='tight', facecolor='white')
    print(f"✓ Saved: {output_file}")
    plt.close()


def plot_all_metrics_grid(df, output_prefix, format='png'):
    """Create a grid showing all key metrics vs cache size."""
    metrics = [
        ('cacheHitRate', 'Cache Hit Rate', True),
        ('actionabilityFirstRatio', 'Actionability-First', True),
        ('timelinessConsistency', 'Timeliness', True),
        ('avgFreshness', 'Avg Freshness', True),
        ('deliveryRate', 'Delivery Rate', True),
        ('staleAccessRate', 'Stale Access Rate', False),
    ]
    
    # Filter to metrics that exist
    metrics = [(k, l, h) for k, l, h in metrics if k in df.columns]
    
    n_metrics = len(metrics)
    n_cols = 2
    n_rows = (n_metrics + n_cols - 1) // n_cols
    
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(16, 5*n_rows))
    if n_rows == 1:
        axes = axes.reshape(1, -1)
    axes = axes.flatten()
    
    policies = df['policy'].unique()
    
    for idx, (metric_key, metric_label, higher_better) in enumerate(metrics):
        ax = axes[idx]
        
        for policy in policies:
            policy_data = df[df['policy'] == policy].sort_values('cacheSize')
            color = POLICY_COLORS.get(policy, '#6b7280')
            marker = POLICY_MARKERS.get(policy, 'o')
            
            values = policy_data[metric_key].values
            # Convert to percentage if values are 0-1
            if values.max() <= 1.0 and metric_key != 'avgFreshness':
                values = values * 100
            
            ax.plot(policy_data['cacheSize'], values,
                   label=policy, color=color, marker=marker,
                   linewidth=2, markersize=6, alpha=0.8)
        
        ax.set_xlabel('Cache Size', fontweight='bold')
        ylabel = f'{metric_label} (%)' if df[metric_key].max() <= 1.1 else metric_label
        ax.set_ylabel(ylabel, fontweight='bold')
        ax.set_title(metric_label, fontweight='bold', fontsize=11)
        ax.grid(True, alpha=0.3)
        ax.legend(loc='best', fontsize=8)
    
    # Hide extra subplots
    for idx in range(n_metrics, len(axes)):
        axes[idx].axis('off')
    
    scenario = df['scenario'].iloc[0] if 'scenario' in df.columns else 'Unknown'
    fig.suptitle(f'Policy Scaling Analysis Across Device Capabilities\nScenario: {scenario}',
                fontsize=15, fontweight='bold', y=0.998)
    
    plt.tight_layout(rect=[0, 0, 1, 0.99])
    output_file = f"{output_prefix}_all_metrics_grid.{format}"
    plt.savefig(output_file, bbox_inches='tight', facecolor='white')
    print(f"✓ Saved: {output_file}")
    plt.close()


def plot_efficiency_analysis(df, output_prefix, format='png'):
    """Analyze which policy gives best bang-for-buck at different cache sizes."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))
    
    cache_sizes = sorted(df['cacheSize'].unique())
    policies = df['policy'].unique()
    
    # Left plot: Actionability per cache entry
    ax1.set_title('Actionability Efficiency\n(Actionable alerts per cache entry)', 
                 fontweight='bold', fontsize=12)
    for policy in policies:
        policy_data = df[df['policy'] == policy].sort_values('cacheSize')
        efficiency = policy_data['actionabilityFirstRatio'] / (policy_data['cacheSize'] / 100)
        color = POLICY_COLORS.get(policy, '#6b7280')
        marker = POLICY_MARKERS.get(policy, 'o')
        ax1.plot(policy_data['cacheSize'], efficiency,
                label=policy, color=color, marker=marker, linewidth=2.5, markersize=8, alpha=0.8)
    
    ax1.set_xlabel('Cache Size (entries)', fontweight='bold')
    ax1.set_ylabel('Efficiency Score', fontweight='bold')
    ax1.legend(loc='best')
    ax1.grid(True, alpha=0.3)
    
    # Right plot: Timeliness per cache entry
    ax2.set_title('Timeliness Efficiency\n(Timely retrievals per cache entry)', 
                 fontweight='bold', fontsize=12)
    for policy in policies:
        policy_data = df[df['policy'] == policy].sort_values('cacheSize')
        efficiency = policy_data['timelinessConsistency'] / (policy_data['cacheSize'] / 100)
        color = POLICY_COLORS.get(policy, '#6b7280')
        marker = POLICY_MARKERS.get(policy, 'o')
        ax2.plot(policy_data['cacheSize'], efficiency,
                label=policy, color=color, marker=marker, linewidth=2.5, markersize=8, alpha=0.8)
    
    ax2.set_xlabel('Cache Size (entries)', fontweight='bold')
    ax2.set_ylabel('Efficiency Score', fontweight='bold')
    ax2.legend(loc='best')
    ax2.grid(True, alpha=0.3)
    
    fig.suptitle('Policy Efficiency Analysis: Performance per Cache Entry',
                fontsize=14, fontweight='bold', y=1.00)
    
    plt.tight_layout()
    output_file = f"{output_prefix}_efficiency_analysis.{format}"
    plt.savefig(output_file, bbox_inches='tight', facecolor='white')
    print(f"✓ Saved: {output_file}")
    plt.close()


def plot_winner_heatmap(df, output_prefix, format='png'):
    """Create a heatmap showing which policy wins at each cache size for each metric."""
    metrics = [
        ('cacheHitRate', 'Cache Hit Rate', True),
        ('actionabilityFirstRatio', 'Actionability', True),
        ('timelinessConsistency', 'Timeliness', True),
        ('avgFreshness', 'Freshness', True),
        ('deliveryRate', 'Delivery', True),
    ]
    
    # Filter to existing metrics
    metrics = [(k, l, h) for k, l, h in metrics if k in df.columns]
    
    cache_sizes = sorted(df['cacheSize'].unique())
    
    # Use consistent policy order matching POLICY_COLORS definition
    policy_order = ['LRU', 'TTLOnly', 'PriorityFresh', 'PAFTinyLFU']
    policies = [p for p in policy_order if p in df['policy'].unique()]
    
    # Create winner matrix and labels
    winner_matrix = np.zeros((len(metrics), len(cache_sizes)))
    winner_labels = []
    tie_cells = []  # Track cells with ties
    
    for i, (metric_key, _, higher_better) in enumerate(metrics):
        row_labels = []
        for j, cache_size in enumerate(cache_sizes):
            cache_data = df[df['cacheSize'] == cache_size]
            
            # Get values for all policies
            policy_values = {}
            for policy in policies:
                policy_data = cache_data[cache_data['policy'] == policy]
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
    fig, ax = plt.subplots(figsize=(12, 8))
    
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
    ax.set_yticks(np.arange(len(metrics)))
    ax.set_xticklabels(cache_sizes)
    ax.set_yticklabels([label for _, label, _ in metrics])
    
    # Add text annotations
    for i in range(len(metrics)):
        for j in range(len(cache_sizes)):
            label = winner_labels[i][j]
            # Use smaller font for tie labels
            fontsize = 8 if "/" in label or label == "ANY" else 10
            text = ax.text(j, i, label,
                         ha="center", va="center", color="white", 
                         fontweight='bold', fontsize=fontsize)
    
    ax.set_xlabel('Cache Size (entries)', fontweight='bold', fontsize=12)
    ax.set_ylabel('Metric', fontweight='bold', fontsize=12)
    ax.set_title('Policy Winner by Cache Size and Metric\n(Shows which policy wins at each cache size)',
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
    
    plt.tight_layout()
    output_file = f"{output_prefix}_winner_heatmap.{format}"
    plt.savefig(output_file, bbox_inches='tight', facecolor='white')
    print(f"✓ Saved: {output_file}")
    plt.close()


def plot_device_comparison(df, output_prefix, format='png'):
    """Create a comparison showing low-end vs high-end device performance."""
    cache_sizes = sorted(df['cacheSize'].unique())
    
    if len(cache_sizes) < 2:
        print("⚠ Skipping device comparison (need at least 2 cache sizes)")
        return
    
    # Define low and high end
    low_end_size = cache_sizes[0]
    high_end_size = cache_sizes[-1]
    
    low_end = df[df['cacheSize'] == low_end_size]
    high_end = df[df['cacheSize'] == high_end_size]
    
    metrics = [
        ('cacheHitRate', 'Hit Rate'),
        ('actionabilityFirstRatio', 'Actionability'),
        ('timelinessConsistency', 'Timeliness'),
        ('avgFreshness', 'Freshness'),
    ]
    
    # Filter to existing metrics
    metrics = [(k, l) for k, l in metrics if k in df.columns]
    
    fig, axes = plt.subplots(1, len(metrics), figsize=(4*len(metrics), 6))
    if len(metrics) == 1:
        axes = [axes]
    
    policies = df['policy'].unique()
    x = np.arange(len(policies))
    width = 0.35
    
    for idx, (metric_key, metric_label) in enumerate(metrics):
        ax = axes[idx]
        
        low_values = [low_end[low_end['policy'] == p][metric_key].values[0] for p in policies]
        high_values = [high_end[high_end['policy'] == p][metric_key].values[0] for p in policies]
        
        # Convert to percentage
        if max(low_values + high_values) <= 1.0:
            low_values = [v * 100 for v in low_values]
            high_values = [v * 100 for v in high_values]
        
        bars1 = ax.bar(x - width/2, low_values, width, label=f'Low-end ({low_end_size})',
                      color='#ef4444', alpha=0.7, edgecolor='black', linewidth=0.5)
        bars2 = ax.bar(x + width/2, high_values, width, label=f'High-end ({high_end_size})',
                      color='#10b981', alpha=0.7, edgecolor='black', linewidth=0.5)
        
        ax.set_ylabel(f'{metric_label} (%)', fontweight='bold')
        ax.set_title(metric_label, fontweight='bold')
        ax.set_xticks(x)
        ax.set_xticklabels(policies, rotation=15, ha='right')
        ax.legend(loc='best', fontsize=8)
        ax.grid(axis='y', alpha=0.3)
        
        # Add value labels
        for bars in [bars1, bars2]:
            for bar in bars:
                height = bar.get_height()
                ax.text(bar.get_x() + bar.get_width()/2., height,
                       f'{height:.1f}', ha='center', va='bottom', fontsize=7)
    
    fig.suptitle('Device Capability Comparison: Low-end vs High-end\n(Same Location, Different Hardware)',
                fontsize=14, fontweight='bold', y=0.99)
    
    plt.tight_layout(rect=[0, 0, 1, 0.97])
    output_file = f"{output_prefix}_device_comparison.{format}"
    plt.savefig(output_file, bbox_inches='tight', facecolor='white')
    print(f"✓ Saved: {output_file}")
    plt.close()


def print_summary_stats(df):
    """Print summary statistics."""
    print("\n" + "="*70)
    print("CACHE SIZE SCALING ANALYSIS")
    print("="*70)
    
    cache_sizes = sorted(df['cacheSize'].unique())
    policies = df['policy'].unique()
    
    print(f"\nCache sizes tested: {cache_sizes}")
    print(f"Policies: {', '.join(policies)}")
    
    if 'scenario' in df.columns:
        print(f"Scenario: {df['scenario'].iloc[0]}")
    if 'seed' in df.columns:
        print(f"Seed: {df['seed'].iloc[0]}")
    
    print("\n" + "-"*70)
    print("Performance at Smallest Cache Size ({} entries):".format(cache_sizes[0]))
    print("-"*70)
    
    smallest_df = df[df['cacheSize'] == cache_sizes[0]]
    for policy in policies:
        policy_data = smallest_df[smallest_df['policy'] == policy].iloc[0]
        print(f"\n{policy}:")
        print(f"  Hit Rate:         {policy_data['cacheHitRate']*100:6.2f}%")
        print(f"  Actionability:    {policy_data['actionabilityFirstRatio']*100:6.2f}%")
        print(f"  Timeliness:       {policy_data['timelinessConsistency']*100:6.2f}%")
    
    print("\n" + "-"*70)
    print("Performance at Largest Cache Size ({} entries):".format(cache_sizes[-1]))
    print("-"*70)
    
    largest_df = df[df['cacheSize'] == cache_sizes[-1]]
    for policy in policies:
        policy_data = largest_df[largest_df['policy'] == policy].iloc[0]
        print(f"\n{policy}:")
        print(f"  Hit Rate:         {policy_data['cacheHitRate']*100:6.2f}%")
        print(f"  Actionability:    {policy_data['actionabilityFirstRatio']*100:6.2f}%")
        print(f"  Timeliness:       {policy_data['timelinessConsistency']*100:6.2f}%")
    
    print("\n" + "="*70)


def main():
    parser = argparse.ArgumentParser(
        description='Compare policy performance across different cache sizes (device capabilities)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Compare 3 different cache sizes
  python plot_cache_size_comparison.py --files data/comparison-32.csv data/comparison-128.csv data/comparison-512.csv
  
  # With custom output and PDF format
  python plot_cache_size_comparison.py --files data/*.csv --output figures/scaling --format pdf --stats
        """
    )
    parser.add_argument('--files', '-f', nargs='+', required=True,
                       help='Paths to multi-policy comparison CSV files (different cache sizes)')
    parser.add_argument('--output', '-o', help='Output file prefix (default: cache_size_comparison)')
    parser.add_argument('--format', choices=['png', 'pdf', 'svg'], default='png',
                       help='Output format (default: png)')
    parser.add_argument('--stats', '-s', action='store_true',
                       help='Print summary statistics')
    
    args = parser.parse_args()
    
    # Determine output prefix
    output_prefix = args.output if args.output else 'cache_size_comparison'
    
    # Load and combine data
    print(f"Loading {len(args.files)} CSV files...")
    df = load_and_combine_data(args.files)
    validate_data(df)
    
    cache_sizes = sorted(df['cacheSize'].unique())
    policies = df['policy'].unique()
    print(f"Found {len(cache_sizes)} cache sizes: {cache_sizes}")
    print(f"Found {len(policies)} policies: {', '.join(policies)}")
    
    # Print stats if requested
    if args.stats:
        print_summary_stats(df)
    
    # Generate plots
    print("\nGenerating plots...")
    
    # Individual scaling curves for key metrics
    plot_scaling_curves(df, 'actionabilityFirstRatio', 'Actionability-First Ratio', 
                       output_prefix, args.format, higher_is_better=True)
    plot_scaling_curves(df, 'timelinessConsistency', 'Timeliness Consistency', 
                       output_prefix, args.format, higher_is_better=True)
    plot_scaling_curves(df, 'avgFreshness', 'Average Freshness', 
                       output_prefix, args.format, higher_is_better=True)
    plot_scaling_curves(df, 'cacheHitRate', 'Cache Hit Rate', 
                       output_prefix, args.format, higher_is_better=True)
    
    # Composite views
    plot_all_metrics_grid(df, output_prefix, args.format)
    plot_efficiency_analysis(df, output_prefix, args.format)
    plot_winner_heatmap(df, output_prefix, args.format)
    plot_device_comparison(df, output_prefix, args.format)
    
    print(f"\n✓ All plots generated successfully!")
    print(f"Output prefix: {output_prefix}")


if __name__ == '__main__':
    main()
