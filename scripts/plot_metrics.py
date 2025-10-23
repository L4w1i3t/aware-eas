"""
Plot multi-policy comparison metrics from CSV file.

Usage:
    python plot_metrics.py data/multi-policy-comparison-TIMESTAMP.csv [--output OUTPUT_FILE] [--format png|pdf|svg]

This script generates:
1. Grouped bar chart comparing all metrics across policies
2. Individual metric comparison charts
3. Radar/spider chart for normalized metrics comparison
"""

import argparse
import sys
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Rectangle
import seaborn as sns
from common import POLICY_COLORS

# Set style
sns.set_style("whitegrid")
plt.rcParams['figure.dpi'] = 150
plt.rcParams['savefig.dpi'] = 300
plt.rcParams['font.size'] = 10
plt.rcParams['axes.labelsize'] = 11
plt.rcParams['axes.titlesize'] = 12
plt.rcParams['legend.fontsize'] = 9

# Define metric groups and properties
METRIC_GROUPS = {
    'Cache Performance': [
        ('cacheHitRate', 'Cache Hit Rate', '%', True),
        ('avgFreshness', 'Avg Freshness', 'score', True),
        ('staleAccessRate', 'Stale Access Rate', '%', False),
    ],
    'Delivery Quality': [
        ('deliveryRate', 'Delivery Rate', '%', True),
        ('redundancyIndex', 'Redundancy Index', '%', False),
    ],
    'User Experience': [
        ('actionabilityFirstRatio', 'Actionability-First', '%', True),
        ('timelinessConsistency', 'Timeliness Consistency', '%', True),
    ],
    'Push Metrics': [
        ('pushesSent', 'Pushes Sent', 'count', True),
        ('pushSuppressRate', 'Push Suppress Rate', '%', False),
        ('pushDuplicateRate', 'Push Duplicate Rate', '%', False),
        ('pushTimelyFirstRatio', 'Push Timely First', '%', True),
    ],
}

# Color scheme for policies is imported from common.py


def load_data(csv_path):
    """Load and validate the CSV data."""
    try:
        df = pd.read_csv(csv_path)
        required_cols = ['policy', 'cacheSize', 'cacheHitRate', 'deliveryRate']
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


def plot_grouped_comparison(df, output_prefix, format='png'):
    """Create grouped bar chart comparing all key metrics."""
    # Select metrics to plot (exclude push metrics if all zero)
    metrics_to_plot = []
    for group, metrics in METRIC_GROUPS.items():
        for metric_key, _, _, _ in metrics:
            if metric_key in df.columns:
                # Skip if all values are zero (e.g., push metrics when disabled)
                if df[metric_key].sum() > 0 or metric_key not in ['pushesSent', 'pushSuppressRate', 'pushDuplicateRate', 'pushTimelyFirstRatio']:
                    metrics_to_plot.append(metric_key)
    
    # Create subplots
    n_metrics = len(metrics_to_plot)
    n_cols = 3
    n_rows = (n_metrics + n_cols - 1) // n_cols
    
    fig, axes = plt.subplots(n_rows, n_cols, figsize=(15, 4 * n_rows))
    if n_rows == 1:
        axes = axes.reshape(1, -1)
    axes = axes.flatten()
    
    policies = df['policy'].tolist()
    x = np.arange(len(policies))
    width = 0.6
    
    for idx, metric_key in enumerate(metrics_to_plot):
        ax = axes[idx]
        values = df[metric_key].values
        
        # Find metric properties
        metric_label = metric_key
        is_percentage = False
        higher_better = True
        
        for group, metrics in METRIC_GROUPS.items():
            for mk, ml, unit, hb in metrics:
                if mk == metric_key:
                    metric_label = ml
                    is_percentage = (unit == '%')
                    higher_better = hb
                    break
        
        # Adjust display for percentages
        display_values = values * 100 if is_percentage and values.max() <= 1.0 else values
        
        # Create bars with policy colors
        colors = [POLICY_COLORS.get(p, '#6b7280') for p in policies]
        bars = ax.bar(x, display_values, width, color=colors, alpha=0.8, edgecolor='black', linewidth=0.5)
        
        # Customize
        ax.set_ylabel('Value (%)' if is_percentage else 'Value')
        ax.set_title(metric_label, fontweight='bold')
        ax.set_xticks(x)
        ax.set_xticklabels(policies, rotation=0)
        ax.grid(axis='y', alpha=0.3)
        
        # Add value labels on bars
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                   f'{height:.1f}',
                   ha='center', va='bottom', fontsize=8)
        
        # Color code: green for higher is better, red for lower is better
        if higher_better:
            best_idx = np.argmax(display_values)
        else:
            best_idx = np.argmin(display_values)
        bars[best_idx].set_edgecolor('gold')
        bars[best_idx].set_linewidth(2.5)
    
    # Hide extra subplots
    for idx in range(n_metrics, len(axes)):
        axes[idx].axis('off')
    
    # Add configuration info as title (robust to missing columns)
    cfg_parts = []
    if 'scenario' in df.columns:
        cfg_parts.append(f"Scenario: {df['scenario'].iloc[0]}")
    if 'cacheSize' in df.columns:
        cfg_parts.append(f"Cache: {df['cacheSize'].iloc[0]}")
    if 'reliability' in df.columns:
        cfg_parts.append(f"Reliability: {df['reliability'].iloc[0]:.2f}")
    if 'durationSec' in df.columns:
        cfg_parts.append(f"Duration: {df['durationSec'].iloc[0]}s")
    config_info = " | ".join(cfg_parts) if cfg_parts else ""
    fig.suptitle(f'Multi-Policy Comparison\n{config_info}', fontsize=14, fontweight='bold', y=0.995)
    
    plt.tight_layout(rect=[0, 0, 1, 0.98])
    output_file = f"{output_prefix}_grouped_comparison.{format}"
    plt.savefig(output_file, bbox_inches='tight', facecolor='white')
    print(f"Saved: {output_file}")
    plt.close()


def plot_radar_chart(df, output_prefix, format='png'):
    """Create radar/spider chart for normalized metrics comparison."""
    # Select key metrics for radar chart (exclude counts)
    radar_metrics = [
        ('cacheHitRate', 'Cache Hit'),
        ('deliveryRate', 'Delivery'),
        ('avgFreshness', 'Freshness'),
        ('actionabilityFirstRatio', 'Actionability'),
        ('timelinessConsistency', 'Timeliness'),
    ]
    
    # Filter to metrics that exist
    radar_metrics = [(k, l) for k, l in radar_metrics if k in df.columns]
    
    if len(radar_metrics) < 3:
        print("⚠ Skipping radar chart (not enough metrics)")
        return
    
    # Prepare data
    categories = [label for _, label in radar_metrics]
    metrics_keys = [key for key, _ in radar_metrics]
    
    # Normalize all metrics to 0-1 scale
    normalized_data = {}
    for policy in df['policy']:
        policy_data = []
        policy_row = df[df['policy'] == policy].iloc[0]
        for metric_key in metrics_keys:
            value = policy_row[metric_key]
            # Most metrics are already 0-1, handle counts differently
            if metric_key == 'pushesSent':
                max_val = df[metric_key].max()
                value = value / max_val if max_val > 0 else 0
            policy_data.append(value)
        normalized_data[policy] = policy_data
    
    # Number of variables
    num_vars = len(categories)
    
    # Compute angle for each axis
    angles = np.linspace(0, 2 * np.pi, num_vars, endpoint=False).tolist()
    
    # Complete the circle
    angles += angles[:1]
    
    # Plot
    fig, ax = plt.subplots(figsize=(10, 10), subplot_kw=dict(projection='polar'))
    
    for policy, values in normalized_data.items():
        values += values[:1]  # Complete the circle
        color = POLICY_COLORS.get(policy, '#6b7280')
        ax.plot(angles, values, 'o-', linewidth=2, label=policy, color=color)
        ax.fill(angles, values, alpha=0.15, color=color)
    
    # Fix axis to go in the right order and start at 12 o'clock
    ax.set_theta_offset(np.pi / 2)
    ax.set_theta_direction(-1)
    
    # Draw axis lines for each angle and label
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(categories, size=11)
    
    # Set y-axis limits and labels
    ax.set_ylim(0, 1)
    ax.set_yticks([0.25, 0.5, 0.75, 1.0])
    ax.set_yticklabels(['25%', '50%', '75%', '100%'], size=9)
    ax.grid(True, linestyle='--', alpha=0.5)
    
    # Add legend
    ax.legend(loc='upper right', bbox_to_anchor=(1.3, 1.1))
    
    # Add title
    cfg_parts = []
    if 'cacheSize' in df.columns:
        cfg_parts.append(f"Cache: {df['cacheSize'].iloc[0]}")
    if 'scenario' in df.columns:
        cfg_parts.append(f"Scenario: {df['scenario'].iloc[0]}")
    config_info = " | ".join(cfg_parts)
    plt.title(f'Policy Performance Comparison (Normalized)\n{config_info}', 
              size=14, fontweight='bold', pad=20)
    
    output_file = f"{output_prefix}_radar_comparison.{format}"
    plt.savefig(output_file, bbox_inches='tight', facecolor='white')
    print(f"Saved: {output_file}")
    plt.close()


def plot_summary_table(df, output_prefix, format='png'):
    """Create a summary table with key metrics."""
    # Select key metrics
    key_metrics = [
        ('cacheHitRate', 'Hit Rate'),
        ('deliveryRate', 'Delivery'),
        ('avgFreshness', 'Freshness'),
        ('staleAccessRate', 'Stale'),
        ('actionabilityFirstRatio', 'Action.'),
        ('timelinessConsistency', 'Timely'),
    ]
    
    # Filter to existing metrics
    key_metrics = [(k, l) for k, l in key_metrics if k in df.columns]
    
    # Prepare data for table
    table_data = []
    for _, row in df.iterrows():
        policy_row = [row['policy']]
        for metric_key, _ in key_metrics:
            value = row[metric_key]
            # Format as percentage if < 1.1
            if value < 1.1:
                policy_row.append(f"{value*100:.1f}%")
            else:
                policy_row.append(f"{value:.2f}")
        table_data.append(policy_row)
    
    # Create figure
    fig, ax = plt.subplots(figsize=(12, 3))
    ax.axis('tight')
    ax.axis('off')
    
    # Create table
    col_labels = ['Policy'] + [label for _, label in key_metrics]
    table = ax.table(cellText=table_data, colLabels=col_labels,
                    cellLoc='center', loc='center',
                    colWidths=[0.15] + [0.12] * len(key_metrics))
    
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1, 2)
    
    # Style header
    for i in range(len(col_labels)):
        cell = table[(0, i)]
        cell.set_facecolor('#e5e7eb')
        cell.set_text_props(weight='bold')
    
    # Color code policy rows
    for i, row in enumerate(table_data):
        policy = row[0]
        color = POLICY_COLORS.get(policy, '#6b7280')
        cell = table[(i+1, 0)]
        cell.set_facecolor(color)
        cell.set_text_props(weight='bold', color='white')
    
    # Add title
    cfg_parts = []
    if 'scenario' in df.columns:
        cfg_parts.append(f"Scenario: {df['scenario'].iloc[0]}")
    if 'cacheSize' in df.columns:
        cfg_parts.append(f"Cache: {df['cacheSize'].iloc[0]}")
    if 'seed' in df.columns:
        cfg_parts.append(f"Seed: {df['seed'].iloc[0]}")
    config_info = " | ".join(cfg_parts)
    plt.title(f'Policy Comparison Summary\n{config_info}', 
              fontsize=12, fontweight='bold', pad=20)
    
    output_file = f"{output_prefix}_summary_table.{format}"
    plt.savefig(output_file, bbox_inches='tight', facecolor='white')
    print(f"Saved: {output_file}")
    plt.close()


def main():
    parser = argparse.ArgumentParser(
        description='Generate comparison plots from multi-policy metrics CSV',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python plot_metrics.py data/multi-policy-comparison-1234.csv
  python plot_metrics.py data/multi-policy-comparison-1234.csv --output figures/comparison
  python plot_metrics.py data/multi-policy-comparison-1234.csv --format pdf
        """
    )
    parser.add_argument('csv_file', help='Path to multi-policy comparison CSV file')
    parser.add_argument('--output', '-o', help='Output file prefix (default: same as input without extension)')
    parser.add_argument('--format', '-f', choices=['png', 'pdf', 'svg'], default='png',
                       help='Output format (default: png)')
    
    args = parser.parse_args()
    
    # Determine output prefix
    if args.output:
        output_prefix = args.output
    else:
        output_prefix = Path(args.csv_file).stem
    
    # Load data
    print(f"Loading data from: {args.csv_file}")
    df = load_data(args.csv_file)
    print(f"Found {len(df)} policies: {', '.join(df['policy'].tolist())}")
    
    # Generate plots
    print("\nGenerating plots...")
    plot_grouped_comparison(df, output_prefix, args.format)
    plot_radar_chart(df, output_prefix, args.format)
    plot_summary_table(df, output_prefix, args.format)
    
    print(f"\nAll plots generated successfully!")
    print(f"Output prefix: {output_prefix}")


if __name__ == '__main__':
    main()
