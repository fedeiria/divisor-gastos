import { Routes } from '@angular/router';
import { CreateGroup } from './pages/create-group/create-group';
import { GroupPage } from './pages/group-page/group-page';

export const routes: Routes = [
  { path: '', component: CreateGroup },
  { path: 'group/:id', component: GroupPage },
  { path: '**', redirectTo: '' },
];
