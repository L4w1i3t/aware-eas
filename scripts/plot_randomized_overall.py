"""
Summarize randomized multi-policy runs into average performance figures per policy.

Usage:
    python plot_randomized_overall.py data/randomized-comparison-*.csv [--output OUTPUT_PREFIX] [--format png|pdf|svg]

This reads a randomized-comparison CSV (rows = policies × randomized runs),
aggregates metrics by policy (mean ± std), and produces bar charts and a summary table.
"""

import argparse
from pathlib import Path
import sys
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from common import POLICY_COLORS, POLICY_ORDER

# Style
sns.set_style("whitegrid")
plt.rcParams['figure.dpi'] = 150
plt.rcParams['savefig.dpi'] = 300
plt.rcParams['font.size'] = 10
plt.rcParams['axes.labelsize'] = 11
plt.rcParams['axes.titlesize'] = 12
plt.rcParams['legend.fontsize'] = 9

CORE_PERCENT_METRICS = [
    ('cacheHitRate', 'Cache Hit Rate'),
    ('deliveryRate', 'Delivery Rate'),
    ('actionabilityFirstRatio', 'Actionability-First'),
    ('timelinessConsistency', 'Timeliness Consistency'),
]

ADDITIONAL_METRICS = [
    ('avgFreshness', 'Avg Freshness', False),
    ('staleAccessRate', 'Stale Access Rate', True),  # lower is better
]

PUSH_METRICS = [
    ('pushesSent', 'Pushes Sent', False),
    ('pushSuppressRate', 'Push Suppress Rate', True),
    ('pushDuplicateRate', 'Push Duplicate Rate', True),
    ('pushTimelyFirstRatio', 'Push Timely First', False),
]


def load_data(csv_path: str) -> pd.DataFrame:
    try:
        df = pd.read_csv(csv_path)
    except FileNotFoundError:
        print(f"Error: file not found: {csv_path}")
        sys.exit(1)
    except Exception as e:
        print(f"Error loading CSV: {e}")
        sys.exit(1)

    if 'policy' not in df.columns:
        print("Error: CSV missing required 'policy' column")
        sys.exit(1)
    return df


def aggregate_by_policy(df: pd.DataFrame) -> pd.DataFrame:
    # Determine which metrics exist in the CSV
    metric_keys = [k for k, _ in CORE_PERCENT_METRICS]
    metric_keys += [k for k, _, _ in ADDITIONAL_METRICS]
    metric_keys += [k for k, _, _ in PUSH_METRICS]
    metric_keys = [m for m in metric_keys if m in df.columns]

    grouped = df.groupby('policy')[metric_keys]
    mean = grouped.mean().add_suffix('_mean')
    std = grouped.std(ddof=1).fillna(0).add_suffix('_std')
    out = pd.concat([mean, std], axis=1).reset_index()

    # Ensure policy order is consistent
    out['__order'] = out['policy'].apply(lambda p: POLICY_ORDER.index(p) if p in POLICY_ORDER else 999)
    out = out.sort_values(['__order', 'policy']).drop(columns=['__order'])
    return out


def plot_core_bars(agg: pd.DataFrame, output_prefix: str, file_format: str = 'png'):
    # Prepare 2x2 grid for core percentage metrics
    fig, axes = plt.subplots(2, 2, figsize=(13, 8))
    axes = axes.flatten()

    policies = agg['policy'].tolist()
    colors = [POLICY_COLORS.get(p, '#6b7280') for p in policies]
    x = np.arange(len(policies))
    width = 0.8

    for idx, (key, label) in enumerate(CORE_PERCENT_METRICS):
        if f'{key}_mean' not in agg.columns:
            axes[idx].axis('off')
            continue
        means = (agg[f'{key}_mean'].values * 100.0).astype(float)
        stds = (agg[f'{key}_std'].values * 100.0).astype(float)
        ax = axes[idx]
        bars = ax.bar(x, means, yerr=stds, color=colors, edgecolor='black', linewidth=0.5,
                      alpha=0.85, width=width, capsize=4)
        ax.set_xticks(x)
        ax.set_xticklabels(policies, rotation=0)
        ax.set_ylabel('Value (%)')
        ax.set_title(label, fontweight='bold')
        ax.grid(axis='y', alpha=0.3, linestyle='--')

        # Labels on bars
        for i, bar in enumerate(bars):
            h = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2, h, f"{h:.1f}±{stds[i]:.1f}",
                    ha='center', va='bottom', fontsize=8)

    fig.suptitle('Average Policy Performance Across Randomized Conditions', fontsize=14, fontweight='bold', y=0.995)
    plt.tight_layout(rect=[0, 0, 1, 0.98])
    out = f"{output_prefix}_randomized_core_metrics.{file_format}"
    plt.savefig(out, bbox_inches='tight', facecolor='white')
    print(f"Saved: {out}")
    plt.close()


def plot_core_lines(agg: pd.DataFrame, output_prefix: str, file_format: str = 'png'):
    """Line chart of core metrics (means with error bars) across policies.

    X-axis: metric name; Y-axis: value (%). One line per policy.
    """
    # Determine which core metrics exist
    metrics = [(k, l) for (k, l) in CORE_PERCENT_METRICS if f'{k}_mean' in agg.columns]
    if len(metrics) == 0:
        return

    # Prepare data arrays per policy
    policies = agg['policy'].tolist()
    colors = [POLICY_COLORS.get(p, '#6b7280') for p in policies]
    x = np.arange(len(metrics))

    fig, ax = plt.subplots(figsize=(12, 6))
    for idx, policy in enumerate(policies):
        row = agg[agg['policy'] == policy].iloc[0]
        means = np.array([row[f'{k}_mean'] for k, _ in metrics]) * 100.0
        stds = np.array([row.get(f'{k}_std', 0.0) for k, _ in metrics]) * 100.0
        ax.errorbar(x, means, yerr=stds, label=policy, color=colors[idx], marker='o', linewidth=2, capsize=4)

    ax.set_xticks(x)
    ax.set_xticklabels([l for _, l in metrics], rotation=0)
    ax.set_ylabel('Value (%)')
    ax.set_title('Core Metrics (Mean ± Std) — Line View', fontweight='bold')
    ax.grid(True, alpha=0.3, linestyle='--')
    ax.legend(loc='best')

    plt.tight_layout()
    out = f"{output_prefix}_randomized_core_lines.{file_format}"
    plt.savefig(out, bbox_inches='tight', facecolor='white')
    print(f"Saved: {out}")
    plt.close()


def plot_violins(df: pd.DataFrame, output_prefix: str, file_format: str = 'png'):
    """Violin+box plots per metric showing distribution across randomized runs per policy."""
    import seaborn as sns
    palette = {p: POLICY_COLORS.get(p, '#6b7280') for p in df['policy'].unique()}

    # Metrics to visualize (only those present)
    candidates = [k for k, _ in CORE_PERCENT_METRICS]
    candidates += ['avgFreshness']
    metrics = [m for m in candidates if m in df.columns]

    for key in metrics:
        values = df[key].copy()
        is_pct = values.max() <= 1.0001 and key != 'avgFreshness'
        df_plot = df.copy()
        df_plot['_value'] = values * (100.0 if is_pct else 1.0)

        fig, ax = plt.subplots(figsize=(10, 6))
        # Use hue='policy' to avoid seaborn deprecation (palette without hue)
        sns.violinplot(data=df_plot, x='policy', y='_value', hue='policy', dodge=False,
                       palette=palette, inner=None, cut=0, linewidth=0.5, ax=ax, alpha=0.9)
        sns.boxplot(data=df_plot, x='policy', y='_value', hue='policy', dodge=False,
                    palette=palette, showcaps=True,
                    boxprops={'facecolor': 'white', 'alpha': 0.6}, showfliers=False,
                    whiskerprops={'linewidth': 1}, ax=ax)
        # Remove any legend generated by hue duplication
        try:
            leg = ax.get_legend()
            if leg is not None:
                leg.remove()
        except Exception:
            pass
        sns.stripplot(data=df_plot, x='policy', y='_value', color='black', size=1.5, jitter=0.2, alpha=0.4, ax=ax)

        ax.set_xlabel('Policy')
        ax.set_ylabel(f"{dict(CORE_PERCENT_METRICS+[('avgFreshness','Avg Freshness')])[key]}" + (" (%)" if is_pct else ""))
        ax.set_title(f"Distribution across randomized runs — {key}", fontweight='bold')
        ax.grid(axis='y', alpha=0.3)

        plt.tight_layout()
        out = f"{output_prefix}_randomized_violin_{key}.{file_format}"
        plt.savefig(out, bbox_inches='tight', facecolor='white')
        print(f"Saved: {out}")
        plt.close()


def plot_ecdf_grid(df: pd.DataFrame, output_prefix: str, file_format: str = 'png'):
    """ECDF (CDF) plots per metric to compare policy robustness across distributions."""
    import seaborn as sns
    palette = {p: POLICY_COLORS.get(p, '#6b7280') for p in df['policy'].unique()}

    # Focus on three core metrics if available
    keys = [k for k in ['deliveryRate', 'timelinessConsistency', 'cacheHitRate'] if k in df.columns]
    if len(keys) == 0:
        return

    n = len(keys)
    fig, axes = plt.subplots(1, n, figsize=(5*n, 4), sharey=False)
    if n == 1:
        axes = [axes]

    for ax, key in zip(axes, keys):
        values = df[key].copy()
        is_pct = values.max() <= 1.0001
        df_plot = df.copy()
        df_plot['_value'] = values * (100.0 if is_pct else 1.0)
        sns.ecdfplot(data=df_plot, x='_value', hue='policy', palette=palette, ax=ax, linewidth=2)
        ax.set_xlabel(f"{dict(CORE_PERCENT_METRICS)[key]}" + (" (%)" if is_pct else ""))
        ax.set_ylabel('CDF')
        ax.set_title(f"ECDF — {key}", fontweight='bold')
        ax.grid(True, alpha=0.3, linestyle='--')

    handles, labels = axes[0].get_legend_handles_labels()
    if handles:
        fig.legend(handles, labels, loc='upper center', ncol=min(4, len(labels)))
    for ax in axes:
        ax.legend_.remove() if ax.get_legend() else None

    plt.tight_layout(rect=[0, 0, 1, 0.92])
    out = f"{output_prefix}_randomized_ecdf.{file_format}"
    plt.savefig(out, bbox_inches='tight', facecolor='white')
    print(f"Saved: {out}")
    plt.close()


def plot_summary_table(agg: pd.DataFrame, output_prefix: str, file_format: str = 'png'):
    # Select subset of metrics for table
    table_metrics = [
        ('cacheHitRate', 'Hit Rate'),
        ('deliveryRate', 'Delivery'),
        ('actionabilityFirstRatio', 'Actionability'),
        ('timelinessConsistency', 'Timeliness'),
        ('avgFreshness', 'Freshness'),
    ]
    table_metrics = [m for m in table_metrics if f'{m[0]}_mean' in agg.columns]

    # Prepare cell text
    rows = []
    for _, row in agg.iterrows():
        cells = [row['policy']]
        for key, _ in table_metrics:
            mean = row[f'{key}_mean']
            std = row.get(f'{key}_std', 0)
            if mean <= 1.1 and key != 'avgFreshness':
                cells.append(f"{mean*100:.1f}±{std*100:.1f}%")
            else:
                cells.append(f"{mean:.3f}±{std:.3f}")
        rows.append(cells)

    fig, ax = plt.subplots(figsize=(12, 2 + 0.4*len(rows)))
    ax.axis('off')
    col_labels = ['Policy'] + [label for _, label in table_metrics]
    table = ax.table(cellText=rows, colLabels=col_labels, loc='center', cellLoc='center')
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1, 1.3)
    plt.title('Randomized Overall Performance (Mean ± Std)', fontsize=12, fontweight='bold', pad=14)
    out = f"{output_prefix}_randomized_summary_table.{file_format}"
    plt.savefig(out, bbox_inches='tight', facecolor='white')
    print(f"Saved: {out}")
    plt.close()


def main():
    parser = argparse.ArgumentParser(
        description='Summarize randomized comparisons into average policy performance figures',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='Example: python plot_randomized_overall.py data/randomized-comparison-123.csv --output figures/randomized --format png'
    )
    parser.add_argument('csv_file', help='Path to a randomized-comparison CSV file')
    parser.add_argument('--output', '-o', help='Output file prefix (default: based on input)')
    parser.add_argument('--format', '-f', choices=['png', 'pdf', 'svg'], default='png')
    args = parser.parse_args()

    output_prefix = args.output if args.output else Path(args.csv_file).stem
    print(f"Loading: {args.csv_file}")
    df = load_data(args.csv_file)
    print(f"Rows: {len(df)} | Policies: {', '.join(sorted(df['policy'].unique()))}")

    agg = aggregate_by_policy(df)
    print("Computed per-policy means/std.")

    plot_core_bars(agg, output_prefix, args.format)
    plot_core_lines(agg, output_prefix, args.format)
    plot_violins(df, output_prefix, args.format)
    plot_ecdf_grid(df, output_prefix, args.format)
    plot_summary_table(agg, output_prefix, args.format)

    print("\nAll randomized overall figures generated.")


if __name__ == '__main__':
    main()
