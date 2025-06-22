# PRD: OpenAI Evals Setup for Maintainer Identification

## Project Overview

### Objective
Implement a comprehensive evaluation framework using OpenAI Evals to continuously test and improve the accuracy of our maintainer identification system.

### Background
After fixing data consistency issues, we need a robust evaluation system to measure and improve the accuracy of our GitHub contributor role classification (owner/maintainer/contributor). This will enable data-driven improvements to our confidence scoring algorithms.

### Success Metrics
- ✅ Evaluation framework accurately measures classification accuracy >85%
- ✅ Automated eval runs detect classification regressions within 24 hours
- ✅ Ground truth dataset established with >1000 verified classifications
- ✅ CI/CD integration provides continuous accuracy monitoring
- ✅ Precision/recall metrics available for each role type (owner/maintainer/contributor)

## Current State Analysis

### Existing Classification System
- Confidence scoring algorithm using GitHub events (merges, pushes, releases)
- Role determination based on confidence thresholds (0.95+ = owner, 0.8+ = maintainer)
- Detection methods: merge_event, push_to_protected, admin_action, etc.
- Database: `contributor_roles` table with confidence scores and detection methods

### OpenAI Evals Framework Requirements
- **Data Format**: JSONL (JSON Lines) with input/expected output pairs
- **Configuration**: YAML files defining eval parameters and metrics
- **Templates**: Classification templates for accuracy evaluation
- **Integration**: Command line tools (`oaieval`, `oaievalset`) and API integration

## Implementation Plan

### Phase 1: Data Preparation & Ground Truth (3-4 days)
**Priority: HIGH**

#### 1.1 Ground Truth Dataset Creation
- [ ] Extract 1000+ contributor classifications from cleaned database
- [ ] Manual verification of high-confidence cases by domain experts
- [ ] Create stratified samples across different role types and repositories
- [ ] Document verification criteria and edge case handling

#### 1.2 Feature Engineering for Evaluation
- [ ] Transform GitHub events into evaluation input features
- [ ] Normalize confidence scores and detection methods
- [ ] Create feature vectors including temporal patterns
- [ ] Add repository context and user activity metrics

#### 1.3 JSONL Dataset Generation
```jsonl
{
  "input": {
    "user_id": "bdougie",
    "repository": "open-sauced/insights",
    "events": [
      {"type": "PullRequestEvent", "action": "closed", "merged": true},
      {"type": "PushEvent", "ref": "refs/heads/main", "forced": false}
    ],
    "metrics": {
      "privileged_events": 15,
      "total_events": 45,
      "days_active": 120,
      "detection_methods": ["merge_event", "push_to_protected"]
    }
  },
  "ideal": "maintainer"
}
```

#### 1.4 Data Quality Validation
- [ ] Verify no data leakage between training and test sets
- [ ] Balance dataset across role types and repositories
- [ ] Cross-validate ground truth with multiple reviewers
- [ ] Document dataset statistics and distribution

### Phase 2: OpenAI Evals Framework Setup (2-3 days)
**Priority: HIGH**

#### 2.1 Framework Installation & Configuration
- [ ] Install OpenAI Evals via pip: `pip install evals`
- [ ] Set up OPENAI_API_KEY environment variable
- [ ] Configure project structure following Evals conventions
- [ ] Test basic framework functionality

#### 2.2 Custom Eval Creation
```yaml
# evals/registry/evals/maintainer-classification.yaml
maintainer-classification:
  id: maintainer-classification.dev.v1
  description: Evaluates accuracy of GitHub contributor role classification
  disclaimer: "This eval measures maintainer identification accuracy"
  metrics: [accuracy, precision_recall]
```

#### 2.3 Classification Template Implementation
- [ ] Create custom eval class extending `evals.Eval`
- [ ] Implement classification logic for role prediction
- [ ] Add confidence score calibration evaluation
- [ ] Create multi-class classification metrics (owner/maintainer/contributor)

#### 2.4 Evaluation Configurations
```python
# evals/elsuite/maintainer_classification.py
class MaintainerClassificationEval(evals.Eval):
    def __init__(self, completion_fns, **kwargs):
        super().__init__(completion_fns, **kwargs)
        self.confidence_threshold = kwargs.get("confidence_threshold", 0.8)
    
    def eval_sample(self, sample, *_):
        # Extract features and predict role
        prediction = self.predict_role(sample["input"])
        expected = sample["ideal"]
        
        return evals.record_and_check_match(
            prompt=sample["input"],
            sampled=prediction,
            expected=expected
        )
```

### Phase 3: Evaluation Metrics & Analysis (2-3 days)
**Priority: HIGH**

#### 3.1 Core Metrics Implementation
- [ ] **Accuracy**: Overall classification accuracy across all roles
- [ ] **Precision/Recall**: Per-class metrics for owner/maintainer/contributor
- [ ] **F1-Score**: Balanced measure of precision and recall
- [ ] **Confidence Calibration**: How well confidence scores match actual accuracy

#### 3.2 Advanced Analytics
- [ ] **Confusion Matrix**: Detailed breakdown of classification errors
- [ ] **ROC/AUC Curves**: Threshold optimization analysis
- [ ] **Temporal Analysis**: Accuracy trends over time periods
- [ ] **Repository Analysis**: Performance variation across repo types/sizes

#### 3.3 Custom Metrics for Domain-Specific Evaluation
```python
def calculate_maintainer_metrics(predictions, ground_truth):
    """Custom metrics for maintainer identification"""
    metrics = {
        'owner_precision': precision_score(ground_truth, predictions, labels=['owner'], average='macro'),
        'maintainer_recall': recall_score(ground_truth, predictions, labels=['maintainer'], average='macro'),
        'contributor_accuracy': accuracy_score(
            [1 if x == 'contributor' else 0 for x in ground_truth],
            [1 if x == 'contributor' else 0 for x in predictions]
        ),
        'confidence_calibration': calculate_calibration_error(confidence_scores, accuracy)
    }
    return metrics
```

#### 3.4 Error Analysis & Interpretation
- [ ] Identify common misclassification patterns
- [ ] Analyze edge cases and ambiguous contributor types
- [ ] Document bias detection in role assignments
- [ ] Create recommendations for algorithm improvements

### Phase 4: Automation & Integration (2-3 days)
**Priority: MEDIUM**

#### 4.1 CI/CD Integration
- [ ] GitHub Actions workflow for automated eval runs
- [ ] Triggered evaluation on confidence scoring algorithm changes
- [ ] Performance regression detection and alerting
- [ ] Integration with existing test suites

```yaml
# .github/workflows/eval-maintainer-classification.yml
name: Maintainer Classification Evaluation
on:
  pull_request:
    paths: ['src/lib/contributors/**', 'supabase/functions/_shared/**']
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - name: Run Maintainer Classification Eval
        run: |
          oaieval gpt-4o maintainer-classification
          python scripts/analyze_eval_results.py
```

#### 4.2 Monitoring & Alerting
- [ ] Accuracy threshold monitoring (alert if <85%)
- [ ] Confidence score drift detection
- [ ] Classification distribution monitoring
- [ ] Performance degradation alerts

#### 4.3 Reporting & Dashboards
- [ ] Automated eval result reporting
- [ ] Performance trend visualization
- [ ] Model performance comparison over time
- [ ] Stakeholder-friendly accuracy reports

### Phase 5: Advanced Evaluation & Optimization (2-3 days)
**Priority: LOW**

#### 5.1 A/B Testing Framework
- [ ] Compare different confidence threshold values
- [ ] Test alternative detection methods combinations
- [ ] Evaluate temporal weighting strategies
- [ ] Cross-repository generalization testing

#### 5.2 Model Validation Techniques
- [ ] Cross-validation across different time periods
- [ ] Stratified sampling by repository characteristics
- [ ] Bootstrap confidence intervals for metrics
- [ ] Statistical significance testing for improvements

#### 5.3 Eval-Driven Algorithm Improvements
- [ ] Identify algorithm weaknesses from eval results
- [ ] Implement targeted improvements based on error analysis
- [ ] Re-evaluate after each improvement iteration
- [ ] Document improvement impact with before/after metrics

## Technical Guidelines

### File Structure
```
evals/
├── registry/
│   └── evals/
│       └── maintainer-classification.yaml
├── elsuite/
│   └── maintainer_classification.py
└── datasets/
    ├── maintainer_ground_truth.jsonl
    ├── test_cases.jsonl
    └── validation_set.jsonl

scripts/
├── generate_eval_dataset.py
├── analyze_eval_results.py
└── update_ground_truth.py
```

### Dataset Requirements
- **Size**: Minimum 1000 samples, target 2000+
- **Balance**: Equal representation of owner/maintainer/contributor roles
- **Coverage**: Multiple repository types, sizes, and domains
- **Quality**: Manual verification of ground truth labels
- **Freshness**: Regular updates with new contributor data

### Integration Points
- **Database**: Query `contributor_roles` for current classifications
- **API**: Integrate with existing confidence scoring endpoints
- **Frontend**: Display eval results in admin dashboard
- **Monitoring**: Supabase monitoring integration for alerts

## Acceptance Criteria

### Phase 1 Complete ✅
- [ ] Ground truth dataset created with 1000+ verified samples
- [ ] JSONL format properly structured with all required features
- [ ] Data quality validation confirms no leakage or bias
- [ ] Dataset balanced across role types and repository characteristics

### Phase 2 Complete ✅
- [ ] OpenAI Evals framework installed and configured
- [ ] Custom maintainer classification eval implemented
- [ ] YAML configuration files created and tested
- [ ] Basic eval runs successfully with sample data

### Phase 3 Complete ✅
- [ ] Core metrics (accuracy, precision, recall) implemented
- [ ] Advanced analytics (confusion matrix, ROC curves) available
- [ ] Confidence calibration analysis functional
- [ ] Error analysis tools provide actionable insights

### Phase 4 Complete ✅
- [ ] CI/CD pipeline automatically runs evals on code changes
- [ ] Monitoring system alerts on accuracy degradation
- [ ] Automated reporting generates stakeholder-friendly summaries
- [ ] Integration with existing development workflow

### Phase 5 Complete ✅
- [ ] A/B testing framework enables algorithm experimentation
- [ ] Statistical validation confirms improvement significance
- [ ] Eval-driven improvements show measurable accuracy gains
- [ ] Documentation guides future eval-driven development

## Risk Mitigation

### Data Quality Risks
- **Ground Truth Errors**: Multiple reviewer verification process
- **Dataset Bias**: Stratified sampling across repository types
- **Label Inconsistency**: Clear criteria documentation and training
- **Temporal Drift**: Regular dataset updates and revalidation

### Technical Risks
- **API Costs**: Budget monitoring and rate limiting for OpenAI API
- **Performance Impact**: Asynchronous evaluation to avoid blocking
- **Integration Complexity**: Staged rollout with fallback mechanisms
- **Version Compatibility**: Pinned dependencies and compatibility testing

### Operational Risks
- **False Alerts**: Tuned thresholds with historical baseline
- **Eval Maintenance**: Automated dataset updates and quality checks
- **Team Training**: Documentation and training for eval interpretation
- **Business Impact**: Clear escalation procedures for accuracy issues

## Future Enhancements

### Advanced Evaluation Techniques
- **Few-shot Learning**: Evaluate performance with limited training data
- **Transfer Learning**: Cross-repository model generalization
- **Adversarial Testing**: Robustness against edge cases and attacks
- **Interpretability**: SHAP/LIME analysis for feature importance

### Extended Scope
- **Multi-platform**: Extend to GitLab, Bitbucket, other platforms
- **Real-time Evaluation**: Stream processing for live accuracy monitoring
- **User Feedback Integration**: Human-in-the-loop validation
- **Behavioral Analysis**: Time-series evaluation of contributor evolution

## Dependencies

### Prerequisites
- ✅ **Data Consistency Fixes**: Must be completed first for clean evaluation data
- **OpenAI API Access**: Valid API key with sufficient quota
- **Development Environment**: Python 3.8+, pip, git access
- **Database Access**: Read access to `contributor_roles` and related tables

### External Dependencies
- **OpenAI Evals Framework**: Latest stable version
- **GitHub API**: For supplementary data validation
- **Supabase**: Database access for ground truth extraction
- **CI/CD Platform**: GitHub Actions or equivalent

## Success Criteria Summary

1. **Functional**: Eval framework correctly measures classification accuracy
2. **Automated**: CI/CD integration provides continuous monitoring
3. **Actionable**: Error analysis guides algorithm improvements
4. **Reliable**: Consistent results with statistical confidence
5. **Maintainable**: Documentation and processes for ongoing eval management

---

**Estimated Timeline: 11-16 days**
**Priority: HIGH - Critical for ongoing system improvement**
**Dependencies: Data Consistency Fixes (blocking), OpenAI API access**