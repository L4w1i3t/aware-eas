#!/usr/bin/env python3
"""
Plot multi-policy timeline comparison from CSV file.

Usage:
    python plot_timeline.py data/multi-policy-timeline-TIMESTAMP.csv [--output OUTPUT_FILE] [--format png|pdf|svg]

This script generates:
1. Hit rate over time comparison
2. Cache size evolution
3. Hits vs Misses over time
4. Combined performance metrics
"""

import argparse
import sys
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
from common import POLICY_COLORS, POLICY_LINESTYLES

# Set style
sns.set_style("whitegrid")
plt.rcParams['figure.dpi'] = 150
plt.rcParams['savefig.dpi'] = 300
plt.rcParams['font.size'] = 10
plt.rcParams['axes.labelsize'] = 11
plt.rcParams['axes.titlesize'] = 12
plt.rcParams['legend.fontsize'] = 9

# Unified colors and linestyles are imported from common.py


def load_data(csv_path):
    """Load and validate the CSV data."""
    try:
        df = pd.read_csv(csv_path)
        required_cols = ['policy', 'time', 'cacheSize', 'hits', 'misses', 'hitRate']
        missing = [col for col in required_cols if col not in df.columns]
        if missing:
            print(f"Error: Missing required columns: {missing}")
            sys.exit(1)
        return df
    except FileNotFoundError:
        print(f"Error: File not found: {csv_path}")
        sys.exit(1)
    except Exception as e:
        print(f"Error loading CSV: {e}")
        sys.exit(1)


def plot_hit_rate_over_time(df, output_prefix, format='png'):
    """Plot hit rate evolution over time for all policies."""
    fig, ax = plt.subplots(figsize=(12, 6))
    
    policies = df['policy'].unique()
    for policy in policies:
        policy_data = df[df['policy'] == policy]
        color = POLICY_COLORS.get(policy, '#6b7280')
        linestyle = POLICY_LINESTYLES.get(policy, '-')
        ax.plot(policy_data['time'], policy_data['hitRate'] * 100, 
               label=policy, color=color, linestyle=linestyle, linewidth=2, alpha=0.8)
    
    ax.set_xlabel('Time (seconds)', fontweight='bold')
    ax.set_ylabel('Hit Rate (%)', fontweight='bold')
    ax.set_title('Cache Hit Rate Over Time - Policy Comparison', fontsize=14, fontweight='bold', pad=15)
    ax.legend(loc='best', framealpha=0.9)
    ax.grid(True, alpha=0.3)
    ax.set_ylim([0, 105])
    
    # Add vertical lines for time milestones
    max_time = df['time'].max()
    for milestone in [max_time * 0.25, max_time * 0.5, max_time * 0.75]:
        ax.axvline(x=milestone, color='gray', linestyle=':', alpha=0.3, linewidth=1)
    
    plt.tight_layout()
    output_file = f"{output_prefix}_hit_rate_timeline.{format}"
    plt.savefig(output_file, bbox_inches='tight', facecolor='white')
    print(f"Saved: {output_file}")
    plt.close()


def plot_cache_size_evolution(df, output_prefix, format='png'):
    """Plot cache size growth over time."""
    fig, ax = plt.subplots(figsize=(12, 6))
    
    policies = df['policy'].unique()
    for policy in policies:
        policy_data = df[df['policy'] == policy]
        color = POLICY_COLORS.get(policy, '#6b7280')
        linestyle = POLICY_LINESTYLES.get(policy, '-')
        ax.plot(policy_data['time'], policy_data['cacheSize'], 
               label=policy, color=color, linestyle=linestyle, linewidth=2, alpha=0.8)
    
    ax.set_xlabel('Time (seconds)', fontweight='bold')
    ax.set_ylabel('Cache Size (entries)', fontweight='bold')
    ax.set_title('Cache Size Evolution Over Time', fontsize=14, fontweight='bold', pad=15)
    ax.legend(loc='best', framealpha=0.9)
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    output_file = f"{output_prefix}_cache_size_timeline.{format}"
    plt.savefig(output_file, bbox_inches='tight', facecolor='white')
    print(f"Saved: {output_file}")
    plt.close()


def plot_hits_misses_over_time(df, output_prefix, format='png'):
    """Plot cumulative hits and misses over time."""
    policies = df['policy'].unique()
    
    # Create 2 subplots: hits and misses
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))
    
    # Plot hits
    for policy in policies:
        policy_data = df[df['policy'] == policy]
        color = POLICY_COLORS.get(policy, '#6b7280')
        linestyle = POLICY_LINESTYLES.get(policy, '-')
        ax1.plot(policy_data['time'], policy_data['hits'], 
                label=policy, color=color, linestyle=linestyle, linewidth=2, alpha=0.8)
    
    ax1.set_xlabel('Time (seconds)', fontweight='bold')
    ax1.set_ylabel('Cumulative Hits', fontweight='bold')
    ax1.set_title('Cache Hits Over Time', fontsize=12, fontweight='bold')
    ax1.legend(loc='best', framealpha=0.9)
    ax1.grid(True, alpha=0.3)
    
    # Plot misses
    for policy in policies:
        policy_data = df[df['policy'] == policy]
        color = POLICY_COLORS.get(policy, '#6b7280')
        linestyle = POLICY_LINESTYLES.get(policy, '-')
        ax2.plot(policy_data['time'], policy_data['misses'], 
                label=policy, color=color, linestyle=linestyle, linewidth=2, alpha=0.8)
    
    ax2.set_xlabel('Time (seconds)', fontweight='bold')
    ax2.set_ylabel('Cumulative Misses', fontweight='bold')
    ax2.set_title('Cache Misses Over Time', fontsize=12, fontweight='bold')
    ax2.legend(loc='best', framealpha=0.9)
    ax2.grid(True, alpha=0.3)
    
    plt.suptitle('Hits and Misses Comparison', fontsize=14, fontweight='bold', y=1.02)
    plt.tight_layout()
    
    output_file = f"{output_prefix}_hits_misses_timeline.{format}"
    plt.savefig(output_file, bbox_inches='tight', facecolor='white')
    print(f"Saved: {output_file}")
    plt.close()


def plot_combined_dashboard(df, output_prefix, format='png'):
    """Create a combined dashboard with multiple metrics."""
    fig = plt.figure(figsize=(16, 10))
    gs = fig.add_gridspec(3, 2, hspace=0.3, wspace=0.3)
    
    policies = df['policy'].unique()
    
    # 1. Hit Rate
    ax1 = fig.add_subplot(gs[0, :])
    for policy in policies:
        policy_data = df[df['policy'] == policy]
        color = POLICY_COLORS.get(policy, '#6b7280')
        linestyle = POLICY_LINESTYLES.get(policy, '-')
        ax1.plot(policy_data['time'], policy_data['hitRate'] * 100, 
                label=policy, color=color, linestyle=linestyle, linewidth=2, alpha=0.8)
    ax1.set_ylabel('Hit Rate (%)', fontweight='bold')
    ax1.set_title('Cache Hit Rate Over Time', fontweight='bold')
    ax1.legend(loc='best', framealpha=0.9, ncol=4)
    ax1.grid(True, alpha=0.3)
    ax1.set_ylim([0, 105])
    
    # 2. Cache Size
    ax2 = fig.add_subplot(gs[1, 0])
    for policy in policies:
        policy_data = df[df['policy'] == policy]
        color = POLICY_COLORS.get(policy, '#6b7280')
        linestyle = POLICY_LINESTYLES.get(policy, '-')
        ax2.plot(policy_data['time'], policy_data['cacheSize'], 
                label=policy, color=color, linestyle=linestyle, linewidth=1.5, alpha=0.8)
    ax2.set_xlabel('Time (seconds)', fontweight='bold')
    ax2.set_ylabel('Cache Size', fontweight='bold')
    ax2.set_title('Cache Size Evolution', fontweight='bold')
    ax2.grid(True, alpha=0.3)
    
    # 3. Cumulative Hits
    ax3 = fig.add_subplot(gs[1, 1])
    for policy in policies:
        policy_data = df[df['policy'] == policy]
        color = POLICY_COLORS.get(policy, '#6b7280')
        linestyle = POLICY_LINESTYLES.get(policy, '-')
        ax3.plot(policy_data['time'], policy_data['hits'], 
                label=policy, color=color, linestyle=linestyle, linewidth=1.5, alpha=0.8)
    ax3.set_xlabel('Time (seconds)', fontweight='bold')
    ax3.set_ylabel('Cumulative Hits', fontweight='bold')
    ax3.set_title('Cache Hits Accumulation', fontweight='bold')
    ax3.grid(True, alpha=0.3)
    
    # 4. Cumulative Misses
    ax4 = fig.add_subplot(gs[2, 0])
    for policy in policies:
        policy_data = df[df['policy'] == policy]
        color = POLICY_COLORS.get(policy, '#6b7280')
        linestyle = POLICY_LINESTYLES.get(policy, '-')
        ax4.plot(policy_data['time'], policy_data['misses'], 
                label=policy, color=color, linestyle=linestyle, linewidth=1.5, alpha=0.8)
    ax4.set_xlabel('Time (seconds)', fontweight='bold')
    ax4.set_ylabel('Cumulative Misses', fontweight='bold')
    ax4.set_title('Cache Misses Accumulation', fontweight='bold')
    ax4.grid(True, alpha=0.3)
    
    # 5. Hit Rate Distribution (boxplot)
    ax5 = fig.add_subplot(gs[2, 1])
    boxplot_data = []
    labels = []
    for policy in policies:
        policy_data = df[df['policy'] == policy]
        # Skip first few samples where hit rate might be 0
        valid_data = policy_data[policy_data['time'] > 10]['hitRate'] * 100
        boxplot_data.append(valid_data)
        labels.append(policy)
    
    # Matplotlib 3.9+ deprecates 'labels' in favor of 'tick_labels'
    bp = ax5.boxplot(boxplot_data, tick_labels=labels, patch_artist=True, showmeans=True)
    for patch, policy in zip(bp['boxes'], labels):
        patch.set_facecolor(POLICY_COLORS.get(policy, '#6b7280'))
        patch.set_alpha(0.6)
    ax5.set_ylabel('Hit Rate (%)', fontweight='bold')
    ax5.set_title('Hit Rate Distribution', fontweight='bold')
    ax5.grid(True, alpha=0.3, axis='y')
    ax5.set_xticklabels(labels, rotation=15, ha='right')
    
    fig.suptitle('Multi-Policy Performance Dashboard', fontsize=16, fontweight='bold', y=0.995)
    
    output_file = f"{output_prefix}_dashboard.{format}"
    plt.savefig(output_file, bbox_inches='tight', facecolor='white')
    print(f"Saved: {output_file}")
    plt.close()


def plot_performance_comparison_final(df, output_prefix, format='png'):
    """Create a publication-ready performance comparison figure."""
    fig, ax = plt.subplots(figsize=(14, 7))
    
    policies = df['policy'].unique()
    
    # Plot with enhanced styling
    for policy in policies:
        policy_data = df[df['policy'] == policy]
        color = POLICY_COLORS.get(policy, '#6b7280')
        linestyle = POLICY_LINESTYLES.get(policy, '-')
        
        # Apply smoothing for cleaner lines (rolling average)
        window = max(1, len(policy_data) // 100)
        smoothed_hitrate = policy_data['hitRate'].rolling(window=window, center=True).mean() * 100
        
        ax.plot(policy_data['time'], smoothed_hitrate, 
               label=policy, color=color, linestyle=linestyle, linewidth=2.5, alpha=0.9)
    
    ax.set_xlabel('Simulation Time (seconds)', fontweight='bold', fontsize=12)
    ax.set_ylabel('Cache Hit Rate (%)', fontweight='bold', fontsize=12)
    ax.set_title('Cache Policy Performance Comparison', fontsize=15, fontweight='bold', pad=20)
    ax.legend(loc='lower right', framealpha=0.95, fontsize=11, 
             frameon=True, shadow=True, ncol=2)
    ax.grid(True, alpha=0.3, linestyle='--')
    ax.set_ylim([0, 105])
    
    # Add confidence bands or shading for better visualization
    max_time = df['time'].max()
    ax.axvspan(0, max_time*0.1, alpha=0.05, color='gray', label='_nolegend_')
    ax.text(max_time*0.05, 102, 'Warm-up', fontsize=9, alpha=0.5, ha='center')
    
    # Add final performance summary text
    final_perf = []
    for policy in policies:
        policy_data = df[df['policy'] == policy]
        final_hr = policy_data.iloc[-1]['hitRate'] * 100
        final_perf.append(f"{policy}: {final_hr:.1f}%")
    
    perf_text = "Final Hit Rates: " + " | ".join(final_perf)
    ax.text(0.5, -0.12, perf_text, transform=ax.transAxes, 
           ha='center', fontsize=9, style='italic', color='#4b5563')
    
    plt.tight_layout()
    output_file = f"{output_prefix}_performance_comparison.{format}"
    plt.savefig(output_file, bbox_inches='tight', facecolor='white')
    print(f"Saved: {output_file}")
    plt.close()


def print_summary_stats(df):
    """Print summary statistics for each policy."""
    print("\n" + "="*60)
    print("SUMMARY STATISTICS")
    print("="*60)
    
    policies = df['policy'].unique()
    for policy in policies:
        policy_data = df[df['policy'] == policy]
        
        # Calculate stats (skip early data for more accurate means)
        warm_up_idx = len(policy_data) // 10
        stable_data = policy_data.iloc[warm_up_idx:]
        
        print(f"\n{policy}:")
        print(f"  Final Hit Rate:    {policy_data.iloc[-1]['hitRate']*100:6.2f}%")
        print(f"  Mean Hit Rate:     {stable_data['hitRate'].mean()*100:6.2f}%")
        print(f"  Std Hit Rate:      {stable_data['hitRate'].std()*100:6.2f}%")
        print(f"  Final Cache Size:  {policy_data.iloc[-1]['cacheSize']:6.0f} entries")
        print(f"  Total Hits:        {policy_data.iloc[-1]['hits']:6.0f}")
        print(f"  Total Misses:      {policy_data.iloc[-1]['misses']:6.0f}")
        
        total_requests = policy_data.iloc[-1]['hits'] + policy_data.iloc[-1]['misses']
        if total_requests > 0:
            print(f"  Overall Hit Rate:  {policy_data.iloc[-1]['hits']/total_requests*100:6.2f}%")
    
    print("\n" + "="*60)


def main():
    parser = argparse.ArgumentParser(
        description='Generate timeline plots from multi-policy timeline CSV',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python plot_timeline.py data/multi-policy-timeline-1234.csv
  python plot_timeline.py data/multi-policy-timeline-1234.csv --output figures/timeline
  python plot_timeline.py data/multi-policy-timeline-1234.csv --format pdf --stats
        """
    )
    parser.add_argument('csv_file', help='Path to multi-policy timeline CSV file')
    parser.add_argument('--output', '-o', help='Output file prefix (default: same as input without extension)')
    parser.add_argument('--format', '-f', choices=['png', 'pdf', 'svg'], default='png',
                       help='Output format (default: png)')
    parser.add_argument('--stats', '-s', action='store_true',
                       help='Print summary statistics')
    
    args = parser.parse_args()
    
    # Determine output prefix
    if args.output:
        output_prefix = args.output
    else:
        output_prefix = Path(args.csv_file).stem
    
    # Load data
    print(f"Loading data from: {args.csv_file}")
    df = load_data(args.csv_file)
    policies = df['policy'].unique()
    print(f"Found {len(policies)} policies: {', '.join(policies)}")
    
    # Print stats if requested
    if args.stats:
        print_summary_stats(df)
    
    # Generate plots
    print("\nGenerating plots...")
    plot_hit_rate_over_time(df, output_prefix, args.format)
    plot_cache_size_evolution(df, output_prefix, args.format)
    plot_hits_misses_over_time(df, output_prefix, args.format)
    plot_combined_dashboard(df, output_prefix, args.format)
    plot_performance_comparison_final(df, output_prefix, args.format)
    
    print(f"\nAll plots generated successfully!")
    print(f"Output prefix: {output_prefix}")


if __name__ == '__main__':
    main()
