# 示例_4.py
# 生成堆叠山峦图（ridgeline plot），依赖: matplotlib、pandas、numpy、joypy
# 运行环境: 本地python_env

import seaborn as sns
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import os
import warnings
warnings.filterwarnings('ignore')
import joypy

np.random.seed(1978)
n = 6
# 构造示例数据
# 每个Feature为一组分布
# 可根据需要调整n和分布参数

data = pd.DataFrame()
for i in range(n):
    data[f'Feature {i+1}'] = np.random.normal(loc=i*2, scale=2, size=100)

plt.figure(figsize=(8, 5))
joypy.joyplot(data, colormap=plt.cm.magma, fade=True, linewidth=1, legend=False)
plt.title('Stacked Ridge (Joy/Ridgeline) Plot Example')
plt.tight_layout()
out_path = os.path.join(os.path.dirname(__file__), '示例_4.png')
plt.savefig(out_path, dpi=120)
print('PNG saved:', out_path) 