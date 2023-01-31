import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StacksStartComponent } from './stacks-start/stacks-start.component';
import { StacksDashboardComponent } from './stacks-dashboard/stacks-dashboard.component';
import { StacksBlockComponent } from '../stacks/stacks-block/stacks-block.component';
import { StacksMempoolBlockComponent } from './stacks-mempool-block/stacks-mempool-block.component';
import { StacksTransactionComponent } from './stacks-transaction/stacks-transaction.component';
import { StacksAddressComponent } from './stacks-address/stacks-address.component';



const routes: Routes = [
  {
    path: '',
    component: StacksStartComponent,
    children: [
      {
        path: '',
        component: StacksDashboardComponent,
      }
    ],
  },
  {
    path: 'block',
    data: { networkSpecific: true },
    component: StacksStartComponent,
    children: [
      {
        path: ':id',
        component: StacksBlockComponent,
        data: {
          ogImage: true
        }
      },
    ],
  },
  {
    path: 'mempool-block/:id',
    data: { networks: ['bitcoin', 'liquid'] },
    component: StacksStartComponent,
    children: [
      {
        path: '',
        component: StacksMempoolBlockComponent,
        data: {
          ogImage: true
        }
      },
    ],
  },
  {
    path: 'address/:id',
    children: [],
    component: StacksAddressComponent,
    data: {
      ogImage: true,
      networkSpecific: true,
    }
  },
  {
    path: 'tx',
    data: { networkSpecific: true },
    component: StacksStartComponent,
    children: [
      {
        path: ':id',
        component: StacksTransactionComponent
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})

export class StacksRoutingModule{ }